import type {
  AssetClass,
  AssetDetails,
  AssetLiquidity,
  PriceSourceKind,
  ValueHistoryPoint,
} from './wealth';

export type MoneyCurrency = 'IRR' | 'IRT';

export type TransactionType =
  | 'deposit'
  | 'withdrawal'
  | 'purchase'
  | 'transfer'
  | 'fee'
  | 'refund'
  | 'reversal'
  | 'unknown';

export type TransactionDirection = 'in' | 'out' | 'internal';

export type TransactionSource =
  | 'android_sms'
  | 'ios_message_filter'
  | 'open_banking'
  | 'csv'
  | 'manual';

export type AccountKind = 'bank' | 'wallet' | 'cash' | 'card' | 'asset';

/** @deprecated Prefer assetClass — kept for legacy snapshots */
export type AssetId =
  | 'gold_gram'
  | 'gold_coin'
  | 'usd'
  | 'eur'
  | 'usdt'
  | 'silver'
  | 'crypto'
  | 'other';

export type SyncStatus = 'pending' | 'processing' | 'synced' | 'failed';

export type CategoryId =
  | 'housing'
  | 'food'
  | 'transport'
  | 'shopping'
  | 'bills'
  | 'health'
  | 'entertainment'
  | 'education'
  | 'travel'
  | 'clothing'
  | 'subscriptions'
  | 'income'
  | 'transfer'
  | 'fee'
  | 'other';

export interface ConfidenceBreakdown {
  bank: number;
  amount: number;
  type: number;
  currency: number;
  merchant: number;
  overall: number;
}

export interface FinancialAccount {
  id: string;
  userId: string;
  kind: AccountKind;
  bankId?: string;
  /** @deprecated Prefer assetClass */
  assetId?: AssetId;
  name: string;
  cardLast4?: string;
  /** Integer Rials — current market / book value (gross asset) */
  balanceRial: number;
  /** Units held (legacy simple assets) */
  quantity?: number;
  /** Rials per unit (legacy) */
  unitPriceRial?: number;
  lastSyncAt?: string;
  transactionCount: number;
  createdAt: string;
  updatedAt: string;

  /* ---- Wealth extension (schema v2+) ---- */
  assetClass?: AssetClass;
  costBasisRial?: number;
  liabilityRial?: number;
  liquidity?: AssetLiquidity;
  priceSource?: PriceSourceKind;
  priceUpdatedAt?: string;
  details?: AssetDetails;
  valueHistory?: ValueHistoryPoint[];
  notes?: string;
}

export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  type: TransactionType;
  direction: TransactionDirection;
  /** Integer Rials */
  amountRial: number;
  currency: MoneyCurrency;
  merchant?: string;
  description?: string;
  categoryId: CategoryId;
  transactionDate: string;
  cardLast4?: string;
  source: TransactionSource;
  sourceId?: string;
  /** Android SMS provider _id when available */
  sourceSmsId?: string;
  /** Sanitized SMS excerpt kept on-device for “why was this recorded?” */
  sourceSmsPreview?: string;
  parserVersion?: string;
  fingerprint: string;
  confidence: number;
  confidenceBreakdown?: ConfidenceBreakdown;
  isConfirmed: boolean;
  needsReview: boolean;
  transferId?: string;
  notes?: string;
  receiptNote?: string;
  /** Absolute account balance from SMS, in Rials */
  balanceAfterRial?: number;
  mergedFromId?: string;
  createdAt: string;
  updatedAt: string;
}

export type GoalKind = 'travel' | 'debt' | 'savings' | 'other';

export interface MoneyGoal {
  id: string;
  userId: string;
  title: string;
  kind: GoalKind;
  targetRial: number;
  savedRial: number;
  deadline?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransferLink {
  id: string;
  userId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amountRial: number;
  date: string;
  outboundTransactionId: string;
  inboundTransactionId: string;
}

export interface Budget {
  id: string;
  userId: string;
  period: 'monthly' | 'yearly';
  year: number;
  month?: number;
  totalLimitRial: number;
  createdAt: string;
}

export interface BudgetCategory {
  id: string;
  budgetId: string;
  categoryId: CategoryId;
  limitRial: number;
}

export interface RecurringTransaction {
  id: string;
  userId: string;
  merchant: string;
  amountRial: number;
  frequency: 'weekly' | 'monthly' | 'yearly';
  categoryId: CategoryId;
  nextExpectedDate: string;
}

export interface CategoryRule {
  id: string;
  userId: string;
  matcher: string;
  categoryId: CategoryId;
  createdAt: string;
}

export interface UnknownSmsRecord {
  id: string;
  userId: string;
  bankId?: string;
  /** Redacted sender for diagnostics — never full PII beyond address short form */
  sender: string;
  patternHash: string;
  parserVersion: string;
  failureReason: string;
  receivedAt: string;
  /** Sanitized body skeleton for developer diagnostics only (local) */
  sanitizedMessage?: string;
  formatId?: string;
  sourceSmsId?: string;
}

export interface SyncQueueItem {
  id: string;
  entity: string;
  entityId: string;
  operation: 'upsert' | 'delete';
  payload: string;
  status: SyncStatus;
  attempts: number;
  lastError?: string;
  nextRetryAt?: string;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  displayName: string;
  phone?: string;
  email?: string;
  avatarUri?: string;
  createdAt: string;
}

export interface NotificationPreferences {
  transactions: boolean;
  assets: boolean;
  budgets: boolean;
  goals: boolean;
  system: boolean;
}

export type AccentId = 'emerald' | 'ocean' | 'violet' | 'gold' | 'rose' | 'graphite';

export type SenderVerificationMethod = 'user_selected_sms' | 'legacy_system';

export type BankConnectionStatus = 'active' | 'pending_sender_verification';

export interface VerifiedSmsSender {
  /** Canonical normalized sender (via normalizeSmsSender) */
  sender: string;
  verifiedAt: string;
  method: SenderVerificationMethod;
}

export interface BankConnection {
  id: string;
  bankId: string;
  status: BankConnectionStatus;
  verifiedSenders: VerifiedSmsSender[];
  createdAt: string;
  updatedAt: string;
}

export interface DiscoveredSmsSender {
  sender: string;
  firstSeenAt: string;
  lastSeenAt: string;
  hitCount: number;
  dismissed?: boolean;
}

export interface UserSettings {
  userId: string;
  hideBalances: boolean;
  reducedMotion: boolean;
  theme: 'dark' | 'light' | 'system';
  /** Visual design generation; 3 = glass daylight redesign (moves users to light once). */
  designVersion?: number;
  /** رنگ تأکید تم */
  accentId?: AccentId;
  notificationsEnabled: boolean;
  budgetAlertsEnabled: boolean;
  smsProcessingEnabled: boolean;
  selectedBankIds: string[];
  /**
   * User-verified (or migrated legacy) bank SMS connections.
   * Authoritative sender allow-list for SMS ingestion.
   */
  bankConnections?: BankConnection[];
  /** Unverified senders spotted at runtime — never auto-trusted */
  discoveredSmsSenders?: DiscoveredSmsSender[];
  onboardingCompleted: boolean;
  smsLastInboxAt?: string;
  /** ISO timestamp of last completed 30-day historical import */
  lastHistoricalImportAt?: string;
  lastImportedSmsId?: string;
  /** Epoch ms of newest SMS processed in last historical import */
  lastImportedTimestamp?: number;
  /**
   * Last fully successful INCREMENTAL SMS sync end timestamp (ISO).
   * Advanced only after the entire requested range completes.
   */
  lastSuccessfulSmsSyncAt?: string;
  /** Epoch ms of newest SMS observed in last successful incremental sync */
  lastSuccessfulSmsSyncSmsDate?: number;
  lastSuccessfulSmsSyncSmsId?: string;
  appLockEnabled: boolean;
  biometricUnlock?: boolean;
  firstSmsWinReady?: boolean;
  firstSmsWinDismissed?: boolean;
  /** Sample data shown before SMS connect */
  guestPreviewActive?: boolean;
  guestPreviewDismissed?: boolean;
  /** Referral / Pro waitlist (marketing; Pro not shipped yet) */
  proWaitlistJoined?: boolean;
  /** لحظه‌های خاص داشبورد */
  firstCalmNightDismissed?: boolean;
  lastMonthClosingKey?: string;
  dismissedMomentIds?: string[];
  /** صدای خزانه + haptic برای تراکنش بزرگ */
  moneySoundEnabled?: boolean;
  /** @deprecated kept only to migrate old installs into Keychain */
  pinHash?: string;

  /* ---- Control Center preferences (single source of truth) ---- */
  /** Display amounts as Toman (IRT) or Rial (IRR) labels */
  displayCurrency?: 'IRT' | 'IRR';
  calendar?: 'jalali' | 'gregorian';
  /** 1–28 */
  financialMonthStartDay?: number;
  /** Yearly inflation % the user assumes for real-value figures (default 35). */
  annualInflationPct?: number;
  defaultAccountId?: string;
  insightsEnabled?: boolean;
  autoPriceUpdates?: boolean;
  notificationPrefs?: NotificationPreferences;
  lastManualBackupAt?: string;
  lastCloudFlushAt?: string;
}

export interface MonthlySnapshot {
  incomeRial: number;
  expenseRial: number;
  savingsRial: number;
  savingsRate: number;
  transferRial: number;
}
