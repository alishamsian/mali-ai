import type { FinancialAccount, Transaction } from '../../types/finance';
import type { Cheque, InstallmentPlan, PersonalDebt, SplitGroup } from '../../types/obligations';
import { monthEndForecast, upcomingDues } from './dues';
import { suggestDueMatches } from './matching';
import { balancesByPerson, debtRemainingRial, installmentSchedule, planStatus } from './schedule';
import { expenseShares, isGroupSettled, memberSummaries, settleUp } from './split';
import {
  dollarMonthOverMonth,
  monthlyInflation,
  purchasingPowerAfter,
  realMonthOverMonth,
} from '../insights/inflation';

const local = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();
const NOW = new Date(2026, 9, 27, 12); // 27 Oct 2026

function plan(overrides: Partial<InstallmentPlan> = {}): InstallmentPlan {
  return {
    id: 'p1',
    kind: 'loan',
    title: 'وام مسکن',
    lender: 'بانک ملی',
    installmentRial: 5_000_000,
    totalCount: 12,
    firstDueDate: local(2026, 8, 5),
    payments: [],
    createdAt: local(2026, 7, 1),
    updatedAt: local(2026, 7, 1),
    ...overrides,
  };
}

function tx(id: string, direction: 'in' | 'out', amountRial: number, date: string): Transaction {
  return {
    id,
    userId: 'u',
    accountId: 'acc',
    type: direction === 'in' ? 'deposit' : 'withdrawal',
    direction,
    amountRial,
    currency: 'IRR',
    categoryId: 'other',
    transactionDate: date,
    source: 'android_sms',
    fingerprint: id,
    confidence: 1,
    isConfirmed: true,
    needsReview: false,
    createdAt: date,
    updatedAt: date,
  };
}

const cheque = (overrides: Partial<Cheque> = {}): Cheque => ({
  id: 'c1',
  direction: 'issued',
  amountRial: 30_000_000,
  dueDate: local(2026, 11, 10),
  counterparty: 'فروشگاه مبل',
  status: 'pending',
  createdAt: local(2026, 9, 1),
  updatedAt: local(2026, 9, 1),
  ...overrides,
});

const debt = (overrides: Partial<PersonalDebt> = {}): PersonalDebt => ({
  id: 'd1',
  person: 'علی',
  direction: 'lent',
  amountRial: 20_000_000,
  date: local(2026, 10, 1),
  settlements: [],
  createdAt: local(2026, 10, 1),
  updatedAt: local(2026, 10, 1),
  ...overrides,
});

describe('installment plans', () => {
  it('lays out one installment per month and flags unpaid past ones as overdue', () => {
    const rows = installmentSchedule(plan({ payments: [{ index: 0, paidAt: local(2026, 8, 5), amountRial: 5_000_000 }] }), NOW, 'gregorian');
    expect(rows).toHaveLength(12);
    expect(rows.map(r => new Date(r.dueDate).getMonth() + 1).slice(0, 4)).toEqual([8, 9, 10, 11]);
    expect(rows.filter(r => r.overdue).map(r => r.index)).toEqual([1, 2]);
  });

  it('clamps month-end due dates instead of skipping a month', () => {
    const rows = installmentSchedule(plan({ firstDueDate: local(2026, 1, 31), totalCount: 3 }), NOW, 'gregorian');
    expect(rows.map(r => new Date(r.dueDate).getDate())).toEqual([31, 28, 31]);
  });

  it('summarizes progress, remaining money and the true cost of the loan', () => {
    const status = planStatus(
      plan({
        principalRial: 50_000_000,
        payments: [0, 1, 2].map(i => ({ index: i, paidAt: NOW.toISOString(), amountRial: 5_000_000 })),
      }),
      NOW,
      'gregorian',
    );
    expect(status).toMatchObject({
      paidCount: 3,
      remainingCount: 9,
      remainingRial: 45_000_000,
      totalRial: 60_000_000,
      costOfCreditRial: 10_000_000,
      costOfCreditYearlyPct: 20,
      done: false,
    });
    expect(status.next?.index).toBe(3);
    expect(status.overdue).toHaveLength(0);
  });
});

describe('upcoming dues and month-end forecast', () => {
  const input = {
    plans: [plan({ payments: [0, 1].map(i => ({ index: i, paidAt: NOW.toISOString(), amountRial: 5_000_000 })) })],
    cheques: [cheque(), cheque({ id: 'c2', direction: 'received', amountRial: 8_000_000, dueDate: local(2026, 11, 2) })],
    debts: [debt({ dueDate: local(2026, 11, 20) })],
  };

  it('lists overdue first, then by date, with in/out direction', () => {
    const dues = upcomingDues(input, NOW, 30, 'gregorian');
    expect(dues.map(d => d.key)).toEqual([
      'installment:p1:2', // 5 Oct, overdue
      'cheque:c2', // 2 Nov, received
      'installment:p1:3', // 5 Nov
      'cheque:c1', // 10 Nov
      'debt:d1', // 20 Nov
    ]);
    expect(dues[0]).toMatchObject({ overdue: true, flow: 'out' });
    expect(dues.find(d => d.key === 'cheque:c2')?.flow).toBe('in');
  });

  it('ignores cleared cheques and fully settled debts', () => {
    const dues = upcomingDues(
      {
        plans: [],
        cheques: [cheque({ status: 'cleared' })],
        debts: [debt({ dueDate: local(2026, 11, 1), settlements: [{ id: 's', amountRial: 20_000_000, date: NOW.toISOString() }] })],
      },
      NOW,
    );
    expect(dues).toEqual([]);
  });

  it('projects cash at hand after dues before month end and flags a shortfall', () => {
    const accounts = [
      { id: 'a', kind: 'bank', balanceRial: 25_000_000 },
      { id: 'gold', kind: 'asset', assetClass: 'gold', balanceRial: 900_000_000 },
    ] as FinancialAccount[];
    const forecast = monthEndForecast({ ...input, accounts }, NOW, new Date(2026, 10, 21), 'gregorian');
    // out: 5M overdue + 5M + 30M cheque; in: 8M cheque + 20M debt
    expect(forecast).toMatchObject({ liquidRial: 25_000_000, outRial: 40_000_000, inRial: 28_000_000, projectedRial: 13_000_000, shortfall: false });
    const tight = monthEndForecast({ ...input, debts: [], accounts }, NOW, new Date(2026, 10, 21), 'gregorian');
    expect(tight.shortfall).toBe(true);
  });
});

describe('matching SMS transactions to dues', () => {
  const input = {
    plans: [plan()],
    cheques: [cheque({ dueDate: local(2026, 10, 25) })],
    debts: [debt()],
    transactions: [
      tx('t_inst', 'out', 5_020_000, local(2026, 10, 6)), // close to installment #2 (5 Oct)
      tx('t_cheque', 'out', 30_000_000, local(2026, 10, 25)),
      tx('t_back', 'in', 20_000_000, local(2026, 10, 20)),
      tx('t_noise', 'out', 777_000, local(2026, 10, 20)),
    ],
  };

  it('suggests the closest open due for each matching transaction', () => {
    const matches = suggestDueMatches(input, NOW, new Set(), 'gregorian');
    expect(matches.map(m => [m.due.key, m.transaction.id]).sort()).toEqual(
      [
        ['cheque:c1', 't_cheque'],
        ['debt:d1', 't_back'],
        ['installment:p1:2', 't_inst'],
      ].sort(),
    );
  });

  it('never suggests a dismissed pair or an already linked transaction', () => {
    const dismissed = new Set(['cheque:c1|t_cheque']);
    const linkedInput = {
      ...input,
      plans: [plan({ payments: [{ index: 9, paidAt: NOW.toISOString(), amountRial: 1, transactionId: 't_inst' }] })],
    };
    const keys = suggestDueMatches(linkedInput, NOW, dismissed, 'gregorian').map(m => m.transaction.id);
    expect(keys).toEqual(['t_back']);
  });

  it('does not treat money that moved before a loan as paying it back', () => {
    const matches = suggestDueMatches(
      { ...input, debts: [debt({ date: local(2026, 10, 22) })] },
      NOW,
      new Set(),
      'gregorian',
    );
    expect(matches.some(m => m.due.kind === 'debt')).toBe(false);
  });
});

describe('personal debts', () => {
  it('nets balances per person across directions', () => {
    const balances = balancesByPerson([
      debt({ id: 'a', person: 'علی ', amountRial: 10_000_000 }),
      debt({ id: 'b', person: 'علی', direction: 'borrowed', amountRial: 4_000_000 }),
      debt({ id: 'c', person: 'سارا', amountRial: 2_000_000, settlements: [{ id: 's', amountRial: 500_000, date: NOW.toISOString() }] }),
      debt({ id: 'd', person: 'رضا', amountRial: 1_000_000, settlements: [{ id: 's', amountRial: 1_000_000, date: NOW.toISOString() }] }),
    ]);
    expect(balances.map(b => [b.person, b.netRial])).toEqual([
      ['علی', 6_000_000],
      ['سارا', 1_500_000],
    ]);
    expect(debtRemainingRial(debt({ settlements: [{ id: 's', amountRial: 25_000_000, date: NOW.toISOString() }] }))).toBe(0);
  });
});

describe('group split (dong)', () => {
  const group: SplitGroup = {
    id: 'g',
    title: 'سفر شمال',
    members: [
      { id: 'me', name: 'من', isMe: true },
      { id: 'a', name: 'علی' },
      { id: 's', name: 'سارا' },
    ],
    expenses: [
      { id: 'e1', title: 'ویلا', amountRial: 9_000_000, paidBy: 'me', shares: { me: 1, a: 1, s: 1 }, date: NOW.toISOString() },
      { id: 'e2', title: 'شام', amountRial: 3_000_000, paidBy: 'a', shares: { me: 1, a: 1, s: 1 }, date: NOW.toISOString() },
      { id: 'e3', title: 'بنزین', amountRial: 1_000_000, paidBy: 's', shares: { me: 1, a: 1 }, date: NOW.toISOString() },
    ],
    payments: [],
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  };

  it('splits by weight and keeps every Rial', () => {
    const shares = expenseShares({ id: 'x', title: 'x', amountRial: 100, paidBy: 'me', shares: { me: 1, a: 1, s: 1 }, date: '' });
    expect([...shares.values()].reduce((s, v) => s + v, 0)).toBe(100);
    const weighted = expenseShares({ id: 'x', title: 'x', amountRial: 900, paidBy: 'me', shares: { me: 2, a: 1 }, date: '' });
    expect(Object.fromEntries(weighted)).toEqual({ me: 600, a: 300 });
  });

  it('computes who owes whom with the fewest transfers', () => {
    const summaries = memberSummaries(group);
    expect(Object.fromEntries(summaries.map(s => [s.memberId, s.netRial]))).toEqual({
      me: 9_000_000 - 4_000_000 - 500_000,
      a: 3_000_000 - 4_000_000 - 500_000,
      s: 1_000_000 - 4_000_000,
    });
    const transfers = settleUp(summaries);
    expect(transfers).toEqual([
      { from: 's', to: 'me', amountRial: 3_000_000 },
      { from: 'a', to: 'me', amountRial: 1_500_000 },
    ]);
  });

  it('is settled once the transfers are recorded as payments', () => {
    const paid: SplitGroup = {
      ...group,
      payments: settleUp(memberSummaries(group)).map((t, i) => ({ id: `p${i}`, ...t, date: NOW.toISOString() })),
    };
    expect(settleUp(memberSummaries(paid))).toEqual([]);
    expect(isGroupSettled(paid)).toBe(true);
    expect(isGroupSettled(group)).toBe(false);
  });
});

describe('inflation', () => {
  it('converts a yearly rate to a compounding monthly one', () => {
    expect(Math.pow(1 + monthlyInflation(40), 12)).toBeCloseTo(1.4, 10);
  });

  it('separates nominal growth from real growth', () => {
    const change = realMonthOverMonth(110, 100, 40)!;
    expect(change.nominalPct).toBeCloseTo(10, 5);
    expect(change.realPct).toBeLessThan(10);
    expect(change.realPct).toBeCloseTo((110 / (1 + monthlyInflation(40)) / 100 - 1) * 100, 5);
    expect(realMonthOverMonth(10, 0, 40)).toBeNull();
  });

  it('shows how savings lose purchasing power', () => {
    expect(purchasingPowerAfter(140_000_000, 12, 40)).toBe(100_000_000);
  });

  it('compares months in dollars when both rates are known', () => {
    expect(dollarMonthOverMonth(1_200, 1_000, 12, 10)).toMatchObject({ currentUsd: 100, previousUsd: 100, pct: 0 });
    expect(dollarMonthOverMonth(1_200, 1_000, 12, undefined)).toBeNull();
  });
});
