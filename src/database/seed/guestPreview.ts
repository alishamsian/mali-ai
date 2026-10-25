import type { FinanceSnapshot } from '../schema/snapshot';
import type { FinancialAccount, Transaction } from '../../types/finance';
import { tomanToRial } from '../../utils/currency/money';

const GUEST_ACCOUNT_IDS = new Set(['guest_acc_mellat', 'guest_acc_cash']);

export function isGuestFingerprint(fingerprint: string, id: string): boolean {
  return fingerprint.startsWith('guest_') || id.startsWith('guest_');
}

export function shouldOfferGuestPreview(snapshot: FinanceSnapshot): boolean {
  if (snapshot.settings.guestPreviewDismissed) {
    return false;
  }
  if (snapshot.settings.smsProcessingEnabled) {
    return false;
  }
  if (snapshot.transactions.some(tx => tx.source === 'android_sms')) {
    return false;
  }
  const hasRealData =
    snapshot.transactions.some(tx => !isGuestFingerprint(tx.fingerprint, tx.id)) ||
    snapshot.accounts.some(a => !GUEST_ACCOUNT_IDS.has(a.id));
  return !hasRealData;
}

const now = new Date();
const iso = (daysAgo: number, hour = 12) => {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 20, 0, 0);
  return d.toISOString();
};

const GUEST_ACCOUNTS: FinancialAccount[] = [
  {
    id: 'guest_acc_mellat',
    userId: 'local-user',
    kind: 'bank',
    bankId: 'mellat',
    name: 'بانک ملت',
    cardLast4: '1234',
    balanceRial: tomanToRial(12_450_000),
    transactionCount: 2,
    createdAt: iso(30),
    updatedAt: iso(0),
    assetClass: 'bank',
    liquidity: 'high',
  },
  {
    id: 'guest_acc_cash',
    userId: 'local-user',
    kind: 'cash',
    bankId: 'cash',
    name: 'نقد',
    balanceRial: tomanToRial(850_000),
    transactionCount: 1,
    createdAt: iso(30),
    updatedAt: iso(1),
    liquidity: 'high',
  },
];

const GUEST_TRANSACTIONS: Transaction[] = [
  {
    id: 'guest_tx_1',
    userId: 'local-user',
    accountId: 'guest_acc_mellat',
    type: 'purchase',
    direction: 'out',
    amountRial: tomanToRial(286_000),
    currency: 'IRR',
    merchant: 'کافه نیکو',
    description: 'نمونه — خرید روزانه',
    categoryId: 'food',
    transactionDate: iso(0, 10),
    cardLast4: '1234',
    source: 'manual',
    fingerprint: 'guest_1',
    confidence: 1,
    isConfirmed: true,
    needsReview: false,
    createdAt: iso(0, 10),
    updatedAt: iso(0, 10),
  },
  {
    id: 'guest_tx_2',
    userId: 'local-user',
    accountId: 'guest_acc_mellat',
    type: 'deposit',
    direction: 'in',
    amountRial: tomanToRial(8_500_000),
    currency: 'IRR',
    merchant: 'واریز حقوق',
    description: 'نمونه — درآمد',
    categoryId: 'income',
    transactionDate: iso(2, 9),
    source: 'manual',
    fingerprint: 'guest_2',
    confidence: 1,
    isConfirmed: true,
    needsReview: false,
    createdAt: iso(2, 9),
    updatedAt: iso(2, 9),
  },
  {
    id: 'guest_tx_3',
    userId: 'local-user',
    accountId: 'guest_acc_cash',
    type: 'purchase',
    direction: 'out',
    amountRial: tomanToRial(125_000),
    currency: 'IRR',
    merchant: 'سوپرمارکت',
    description: 'نمونه — خرید نقدی',
    categoryId: 'shopping',
    transactionDate: iso(1, 18),
    source: 'manual',
    fingerprint: 'guest_3',
    confidence: 1,
    isConfirmed: true,
    needsReview: false,
    createdAt: iso(1, 18),
    updatedAt: iso(1, 18),
  },
];

export function applyGuestPreview(snapshot: FinanceSnapshot): FinanceSnapshot {
  return {
    ...snapshot,
    settings: { ...snapshot.settings, guestPreviewActive: true },
    accounts: GUEST_ACCOUNTS,
    transactions: GUEST_TRANSACTIONS,
  };
}

export function clearGuestPreview(snapshot: FinanceSnapshot): FinanceSnapshot {
  const hasGuest =
    snapshot.settings.guestPreviewActive ||
    snapshot.transactions.some(tx => isGuestFingerprint(tx.fingerprint, tx.id));
  if (!hasGuest) {
    return snapshot;
  }
  return {
    ...snapshot,
    settings: {
      ...snapshot.settings,
      guestPreviewActive: false,
      guestPreviewDismissed: true,
    },
    accounts: snapshot.accounts.filter(a => !GUEST_ACCOUNT_IDS.has(a.id)),
    transactions: snapshot.transactions.filter(
      tx => !isGuestFingerprint(tx.fingerprint, tx.id),
    ),
  };
}
