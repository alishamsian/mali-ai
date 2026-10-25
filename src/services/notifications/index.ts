export type NotificationKind =
  | 'new_transaction'
  | 'budget_warning'
  | 'recurring_due'
  | 'spend_spike';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

export function buildBudgetWarning(categoryLabel: string, percent: number): AppNotification {
  return {
    id: `n_${Date.now()}`,
    kind: 'budget_warning',
    title: 'هشدار بودجه',
    body: `${percent}٪ بودجه ${categoryLabel} مصرف شده`,
    createdAt: new Date().toISOString(),
    read: false,
  };
}
