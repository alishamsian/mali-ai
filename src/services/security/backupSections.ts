type Row = Record<string, unknown>;
const object = (v: unknown): v is Row => Boolean(v && typeof v === 'object' && !Array.isArray(v));
const text = (v: unknown) => typeof v === 'string';
const amount = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const date = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
const strings = (r: Row, keys: string[]) => keys.every(k => text(r[k]));
const amounts = (r: Row, keys: string[]) => keys.every(k => amount(r[k]));
const oneOf = (v: unknown, choices: string[]) => typeof v === 'string' && choices.includes(v);

function rows(v: unknown, valid: (r: Row) => boolean, unique = true): boolean {
  if (v == null) {
    return true;
  }
  if (!Array.isArray(v)) {
    return false;
  }
  const ids = new Set<unknown>();
  return v.every(row => {
    if (!object(row) || (unique && (!text(row.id) || !row.id || ids.has(row.id)))) {
      return false;
    }
    ids.add(row.id);
    return valid(row);
  });
}

/** Validate nested records before a restore is allowed to replace working data. */
export function backupSectionsValid(data: unknown): boolean {
  if (!object(data)) {
    return false;
  }
  if (data.settings != null && !object(data.settings)) {
    return false;
  }
  if (
    data.profile != null &&
    (!object(data.profile) || !strings(data.profile, ['id', 'displayName']))
  ) {
    return false;
  }
  const s = data.settings;
  if (object(s)) {
    for (const key of ['selectedBankIds', 'dismissedMomentIds']) {
      if (s[key] != null && (!Array.isArray(s[key]) || !(s[key] as unknown[]).every(text))) {
        return false;
      }
    }
    if (
      !rows(
        s.bankConnections,
        c =>
          strings(c, ['bankId', 'status']) &&
          Array.isArray(c.verifiedSenders) &&
          rows(c.verifiedSenders, v => strings(v, ['sender', 'verifiedAt', 'method']), false),
      ) ||
      !rows(
        s.discoveredSmsSenders,
        c => strings(c, ['sender', 'firstSeenAt', 'lastSeenAt']) && amount(c.hitCount),
        false,
      )
    ) {
      return false;
    }
  }
  return (
    rows(
      data.budgets,
      r =>
        oneOf(r.period, ['monthly', 'yearly']) &&
        amounts(r, ['year', 'totalLimitRial']) &&
        text(r.createdAt),
    ) &&
    rows(
      data.budgetCategories,
      r => strings(r, ['budgetId', 'categoryId']) && amount(r.limitRial),
    ) &&
    rows(
      data.goals,
      r =>
        strings(r, ['title', 'kind', 'createdAt', 'updatedAt']) &&
        amounts(r, ['targetRial', 'savedRial']),
    ) &&
    rows(
      data.recurring,
      r =>
        strings(r, ['merchant', 'categoryId']) &&
        amount(r.amountRial) &&
        oneOf(r.frequency, ['weekly', 'monthly', 'yearly']) &&
        date(r.nextExpectedDate),
    ) &&
    rows(data.rules, r => strings(r, ['matcher', 'categoryId', 'createdAt'])) &&
    rows(
      data.transfers,
      r =>
        strings(r, [
          'sourceAccountId',
          'destinationAccountId',
          'outboundTransactionId',
          'inboundTransactionId',
        ]) &&
        amount(r.amountRial) &&
        date(r.date),
    ) &&
    rows(
      data.netWorthHistory,
      r =>
        date(r.date) &&
        ['assetsRial', 'liabilitiesRial', 'netWorthRial'].every(
          k => typeof r[k] === 'number' && Number.isFinite(r[k]),
        ),
      false,
    ) &&
    rows(
      data.installmentPlans,
      r =>
        oneOf(r.kind, ['loan', 'purchase']) &&
        strings(r, ['title', 'createdAt', 'updatedAt']) &&
        amount(r.installmentRial) &&
        Number.isInteger(r.totalCount) &&
        (r.totalCount as number) > 0 &&
        (r.totalCount as number) <= 1200 &&
        date(r.firstDueDate) &&
        Array.isArray(r.payments) &&
        rows(
          r.payments,
          p =>
            Number.isInteger(p.index) &&
            (p.index as number) >= 0 &&
            (p.index as number) < (r.totalCount as number) &&
            amount(p.amountRial) &&
            date(p.paidAt),
          false,
        ),
    ) &&
    rows(
      data.cheques,
      r =>
        oneOf(r.direction, ['issued', 'received']) &&
        oneOf(r.status, ['pending', 'cleared', 'bounced', 'cancelled']) &&
        amount(r.amountRial) &&
        date(r.dueDate) &&
        strings(r, ['counterparty', 'createdAt', 'updatedAt']),
    ) &&
    rows(
      data.debts,
      r =>
        oneOf(r.direction, ['lent', 'borrowed']) &&
        strings(r, ['person', 'createdAt', 'updatedAt']) &&
        amount(r.amountRial) &&
        date(r.date) &&
        (r.dueDate == null || date(r.dueDate)) &&
        Array.isArray(r.settlements) &&
        rows(r.settlements, p => amount(p.amountRial) && date(p.date)),
    )
  );
}
