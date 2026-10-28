/**
 * Money owed on a schedule or between people: installment plans (loans and buy-now-
 * pay-later), cheques, personal loans to and from friends, and shared group expenses.
 * Amounts are Rial, dates ISO strings, like the rest of the snapshot.
 */

export interface InstallmentPayment {
  /** 0-based installment number. */
  index: number;
  paidAt: string;
  amountRial: number;
  /** The expense this payment matched or created, when there is one. */
  transactionId?: string;
}

export interface InstallmentPlan {
  id: string;
  /** loan = bank/fund loan; purchase = item bought on installments. */
  kind: 'loan' | 'purchase';
  title: string;
  lender?: string;
  installmentRial: number;
  totalCount: number;
  /** Due date of installment #0; the rest fall on the same day of each following month. */
  firstDueDate: string;
  /** Amount borrowed, when known; lets the app show the true cost of the loan. */
  principalRial?: number;
  accountId?: string;
  payments: InstallmentPayment[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type ChequeStatus = 'pending' | 'cleared' | 'bounced' | 'cancelled';

export interface Cheque {
  id: string;
  /** issued = I wrote it (money leaves); received = someone gave it to me. */
  direction: 'issued' | 'received';
  amountRial: number;
  dueDate: string;
  counterparty: string;
  bankName?: string;
  /** 16-digit Sayad id printed on the cheque. */
  sayadId?: string;
  status: ChequeStatus;
  statusAt?: string;
  transactionId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DebtSettlement {
  id: string;
  amountRial: number;
  date: string;
  transactionId?: string;
}

export interface PersonalDebt {
  id: string;
  person: string;
  /** lent = they owe me; borrowed = I owe them. */
  direction: 'lent' | 'borrowed';
  amountRial: number;
  date: string;
  dueDate?: string;
  note?: string;
  settlements: DebtSettlement[];
  createdAt: string;
  updatedAt: string;
}

export interface SplitMember {
  id: string;
  name: string;
  /** The app's user; balances are phrased from their point of view. */
  isMe?: boolean;
}

export interface SplitExpense {
  id: string;
  title: string;
  amountRial: number;
  paidBy: string;
  /** Member id -> weight. Equal split = 1 each; a member missing from the map pays nothing. */
  shares: Record<string, number>;
  date: string;
}

export interface SplitPayment {
  id: string;
  from: string;
  to: string;
  amountRial: number;
  date: string;
}

export interface SplitGroup {
  id: string;
  title: string;
  emoji?: string;
  members: SplitMember[];
  expenses: SplitExpense[];
  /** Money members already paid each other to settle up. */
  payments: SplitPayment[];
  createdAt: string;
  updatedAt: string;
}
