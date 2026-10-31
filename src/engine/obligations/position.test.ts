import { emptySnapshot } from '../../database/schema/snapshot';
import { obligationsPosition } from './position';
import { installmentSchedule, planStatus } from './schedule';
import type { InstallmentPlan, PersonalDebt, Cheque } from '../../types/obligations';

const now = new Date('2026-10-15T12:00:00Z');
const stamp = now.toISOString();
const plan = (extra: Partial<InstallmentPlan>): InstallmentPlan => ({
  id: 'p',
  kind: 'purchase',
  title: 'rent',
  installmentRial: 100,
  totalCount: 1,
  firstDueDate: '2026-10-20T12:00:00Z',
  payments: [],
  createdAt: stamp,
  updatedAt: stamp,
  ...extra,
});

test('an open-ended plan keeps producing the next month after each payment', () => {
  const rent = plan({ openEnded: true });
  expect(installmentSchedule(rent, now, 'gregorian')).toHaveLength(12);
  const paid = plan({ openEnded: true, payments: [{ index: 0, paidAt: stamp }] as never });
  const rows = installmentSchedule(paid, now, 'gregorian');
  expect(rows).toHaveLength(13);
  expect(planStatus(paid, now, 'gregorian').next?.index).toBe(1);
  expect(planStatus(paid, now, 'gregorian').done).toBe(false);
});

test('position splits what I owe and am owed per month and in total', () => {
  const data = emptySnapshot();
  const cheque = (
    id: string,
    direction: Cheque['direction'],
    at: string,
    rial: number,
  ): Cheque => ({
    id,
    direction,
    amountRial: rial,
    dueDate: at,
    counterparty: 'x',
    status: 'pending',
    createdAt: stamp,
    updatedAt: stamp,
  });
  const debt: PersonalDebt = {
    id: 'd',
    person: 'm',
    direction: 'lent',
    amountRial: 500,
    date: stamp,
    settlements: [],
    createdAt: stamp,
    updatedAt: stamp,
  };
  const position = obligationsPosition(
    {
      plans: [plan({ openEnded: true })],
      cheques: [
        cheque('a', 'issued', '2026-10-25T12:00:00Z', 300),
        cheque('b', 'received', '2026-10-28T12:00:00Z', 700),
      ],
      debts: [debt],
    },
    {
      settings: { ...data.settings, calendar: 'gregorian', financialMonthStartDay: 1 },
      transactions: [],
    },
    now,
    3,
    'gregorian',
  );
  // Open-ended rent counts its next month only in the total, every month in the per-month rows.
  expect(position.totalPayRial).toBe(400);
  expect(position.totalReceiveRial).toBe(1200);
  expect(position.months[0]).toMatchObject({ payRial: 400, receiveRial: 700 });
  expect(position.months[1].payRial).toBe(100);
  expect(position.split).toEqual({ installments: 100, cheques: 300, debts: 0 });
});
