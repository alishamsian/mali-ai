import { transformSync } from '@babel/core';
import type { FinancialAccount, Transaction } from '../../types/finance';
import { getSupabase } from '../supabase/client';
import {
  AUTH_REDIRECT_URL,
  completeSignInFromUrl,
  isAuthRedirect,
  sendEmailCode,
  verifyEmailCode,
} from '../supabase/auth';
import { cloudIdFor, cloudTransactionPayload, flushSyncQueue } from './flush';
import { accountFromRow, pullCloudRecords, transactionFromRow } from './pull';
import { createQueueItem } from './queue';

jest.mock('../supabase/client', () => ({
  getSupabase: jest.fn(),
  isSupabaseConfigured: () => true,
}));

const getSupabaseMock = getSupabase as jest.Mock;
const USER = '11111111-2222-4333-8444-555555555555';

const account: FinancialAccount = {
  id: 'acc_sms_mellat_1234',
  userId: 'local-user',
  kind: 'bank',
  bankId: 'mellat',
  name: 'ملت',
  balanceRial: 5_000_000,
  transactionCount: 1,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const tx: Transaction = {
  id: 'tx_sms42',
  userId: 'local-user',
  accountId: account.id,
  type: 'purchase',
  direction: 'out',
  amountRial: 250_000,
  currency: 'IRR',
  categoryId: 'food',
  transactionDate: '2026-10-02T10:00:00.000Z',
  source: 'android_sms',
  sourceSmsId: '9001',
  sourceSmsPreview: 'raw bank sms text',
  balanceAfterRial: 4_750_000,
  fingerprint: 'fp42',
  confidence: 0.9,
  isConfirmed: true,
  needsReview: false,
  createdAt: '2026-10-02T10:00:00.000Z',
  updatedAt: '2026-10-02T10:00:00.000Z',
};

/** A fake Supabase that keeps upserted rows in memory and serves them back. */
function fakeCloud() {
  const tables: Record<string, Map<string, Record<string, unknown>>> = {
    financial_accounts: new Map(),
    transactions: new Map(),
  };
  const auth = {
    getUser: async () => ({ data: { user: { id: USER } } }),
    getSession: async () => ({ data: { session: { user: { id: USER } } } }),
    signInWithOtp: jest.fn(async () => ({ error: null })),
    exchangeCodeForSession: jest.fn(async (code: string) =>
      code === 'good-code' ? { error: null } : { error: { message: 'invalid flow state' } },
    ),
    setSession: jest.fn(async () => ({ error: null })),
    verifyOtp: jest.fn(async ({ token }: { token: string }) =>
      token === '123456'
        ? { data: { session: { user: { id: USER } } }, error: null }
        : { data: { session: null }, error: { message: 'Token has expired or is invalid' } },
    ),
  };
  const client = {
    auth,
    from: (table: string) => ({
      upsert: async (rows: Record<string, unknown>[]) => {
        rows.forEach(row => tables[table].set(String(row.id), row));
        return { error: null };
      },
      delete: () => ({
        eq: async (_c: string, id: string) => {
          tables[table].delete(id);
          return { error: null };
        },
      }),
      select: () => {
        const q = {
          eq: () => q,
          order: () => q,
          range: async (from: number, to: number) => ({
            data: [...tables[table].values()].slice(from, to + 1),
            error: null,
          }),
        };
        return q;
      },
    }),
  };
  getSupabaseMock.mockReturnValue(client);
  return { tables, auth };
}

describe('cloud round trip', () => {
  it('keeps every field except the raw SMS text through upload and restore', async () => {
    const { tables } = fakeCloud();
    await flushSyncQueue([createQueueItem('transactions', tx.id, 'upsert', tx)], {
      accounts: [account],
    });

    const row = tables.transactions.get(cloudIdFor(USER, tx.id))!;
    expect(row.local_id).toBe(tx.id);
    expect(JSON.stringify(row)).not.toContain('raw bank sms text');

    const pulled = await pullCloudRecords();
    expect(pulled.ok).toBe(true);
    if (!pulled.ok) {
      return;
    }
    expect(pulled.records.accounts).toEqual([account]);
    expect(pulled.records.transactions).toEqual([cloudTransactionPayload(tx)]);
    // What restore needs to avoid re-importing the same SMS and to recompute balances:
    expect(pulled.records.transactions[0]).toMatchObject({
      sourceSmsId: '9001',
      balanceAfterRial: 4_750_000,
    });
  });

  it('drops malformed cloud rows instead of importing them', async () => {
    const { tables } = fakeCloud();
    tables.transactions.set('ok', { id: 'ok', payload: tx });
    tables.transactions.set('nan', {
      id: 'nan',
      payload: { ...tx, id: 'tx_nan', amountRial: 'x' },
    });
    tables.transactions.set('date', {
      id: 'date',
      payload: { ...tx, id: 'tx_date', transactionDate: 'soon' },
    });
    tables.financial_accounts.set('acc', { id: 'acc', payload: { ...account, balanceRial: null } });
    const pulled = await pullCloudRecords();
    expect(pulled.ok).toBe(true);
    if (!pulled.ok) {
      return;
    }
    expect(pulled.records.transactions.map(t => t.id)).toEqual([tx.id]);
    expect(pulled.records.accounts).toEqual([]);
    expect(pulled.records.skipped).toBe(3);
  });

  it('reads every page of a large table', async () => {
    const { tables } = fakeCloud();
    for (let i = 0; i < 2_345; i += 1) {
      tables.transactions.set(`r${i}`, { id: `r${i}`, payload: { ...tx, id: `tx_${i}` } });
    }
    const pulled = await pullCloudRecords();
    expect(pulled.ok && pulled.records.transactions.length).toBe(2_345);
  });

  it('rebuilds rows uploaded before payloads existed from their columns', () => {
    const accountRow = {
      id: cloudIdFor(USER, account.id),
      local_id: null,
      user_id: USER,
      kind: 'bank',
      name: 'ملت',
      balance_rial: 100,
      transaction_count: 2,
      created_at: 'c',
      updated_at: 'u',
    };
    const restoredAccount = accountFromRow(accountRow);
    expect(restoredAccount.id).toBe(accountRow.id);

    const restoredTx = transactionFromRow(
      {
        id: 'row-1',
        user_id: USER,
        account_id: accountRow.id,
        type: 'purchase',
        direction: 'out',
        amount_rial: '5000',
        transaction_date: tx.transactionDate,
        source: 'manual',
        fingerprint: 'f',
        is_confirmed: true,
        created_at: 'c',
        updated_at: 'u',
      },
      new Map([[accountRow.id, 'acc_local']]),
    );
    expect(restoredTx).toMatchObject({
      id: 'row-1',
      accountId: 'acc_local',
      amountRial: 5_000,
      categoryId: 'other',
      currency: 'IRR',
    });
  });
});

describe('email sign-in', () => {
  it('sends a code to a normalized email and verifies it', async () => {
    const { auth } = fakeCloud();
    await expect(sendEmailCode('  Ali@Example.com ')).resolves.toEqual({ ok: true });
    expect(auth.signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ali@example.com' }),
    );
    await expect(verifyEmailCode('ali@example.com', '123 456')).resolves.toEqual({ ok: true });
  });

  it('rejects a bad email or a wrong code', async () => {
    fakeCloud();
    await expect(sendEmailCode('not-an-email')).resolves.toEqual({
      ok: false,
      error: 'invalid-email',
    });
    await expect(verifyEmailCode('ali@example.com', '12')).resolves.toEqual({
      ok: false,
      error: 'invalid-code',
    });
    const wrong = await verifyEmailCode('ali@example.com', '000000');
    expect(wrong.ok).toBe(false);
  });
});

describe('email link sign-in', () => {
  it('asks Supabase to send the link back to the app', async () => {
    const { auth } = fakeCloud();
    await sendEmailCode('ali@example.com');
    expect(auth.signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ emailRedirectTo: 'poolet://auth' }),
      }),
    );
  });

  it('recognizes only its own redirect', () => {
    expect(isAuthRedirect(`${AUTH_REDIRECT_URL}?code=x`)).toBe(true);
    expect(isAuthRedirect('https://evil.example/poolet://auth?code=x')).toBe(false);
    expect(isAuthRedirect(null)).toBe(false);
  });

  it('exchanges the PKCE code from the link for a session', async () => {
    const { auth } = fakeCloud();
    await expect(completeSignInFromUrl('poolet://auth?code=good-code')).resolves.toEqual({
      ok: true,
    });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('good-code');
  });

  it('reports an expired or reused link', async () => {
    fakeCloud();
    await expect(completeSignInFromUrl('poolet://auth?code=stale')).resolves.toEqual({
      ok: false,
      error: 'invalid flow state',
    });
    await expect(
      completeSignInFromUrl(
        'poolet://auth#error=access_denied&error_description=Email+link+is+invalid+or+has+expired',
      ),
    ).resolves.toEqual({ ok: false, error: 'Email link is invalid or has expired' });
    await expect(completeSignInFromUrl('poolet://auth')).resolves.toEqual({
      ok: false,
      error: 'no-code',
    });
  });

  it('rejects links that carry ready-made tokens (session fixation)', async () => {
    const { auth } = fakeCloud();
    await expect(
      completeSignInFromUrl('poolet://auth#access_token=a&refresh_token=r&type=magiclink'),
    ).resolves.toEqual({ ok: false, error: 'tokens-in-link' });
    // Even a valid-looking code next to injected tokens is refused.
    await expect(
      completeSignInFromUrl('poolet://auth?code=good-code#access_token=a&refresh_token=r'),
    ).resolves.toEqual({ ok: false, error: 'tokens-in-link' });
    expect(auth.setSession).not.toHaveBeenCalled();
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
});

describe('build-time env inlining', () => {
  const plugin = require('../../../scripts/babel-plugin-inline-env');
  const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } })
    .process.env;

  it('replaces only allow-listed process.env names', () => {
    env.SUPABASE_URL = 'https://abc.supabase.co';
    try {
      const out = transformSync(
        'const a = process.env.SUPABASE_URL; const b = process.env.SECRET; const c = process.env["SUPABASE_URL"];',
        {
          babelrc: false,
          configFile: false,
          plugins: [[plugin, { names: ['SUPABASE_URL'], envFile: '/nonexistent' }]],
        },
      )!.code!;
      expect(out).toContain('const a = "https://abc.supabase.co"');
      expect(out).toContain('const c = "https://abc.supabase.co"');
      expect(out).toContain('process.env.SECRET');
    } finally {
      delete env.SUPABASE_URL;
    }
  });

  it('parses .env lines, quotes and comments', () => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'env-')), '.env');
    fs.writeFileSync(
      file,
      '# comment\nSUPABASE_URL="https://x.supabase.co"\nSUPABASE_ANON_KEY=abc123\n',
    );
    expect(plugin.parseDotEnv(file)).toEqual({
      SUPABASE_URL: 'https://x.supabase.co',
      SUPABASE_ANON_KEY: 'abc123',
    });
  });
});
