import { NativeEventEmitter, NativeModules, PermissionsAndroid, Platform } from 'react-native';

export type InboxSmsRow = {
  id?: string;
  sender: string;
  body: string;
  date: number;
  dateSent?: number;
  type?: number;
  threadId?: string;
};

type SmsNative = {
  startListening?: () => void;
  stopListening?: () => void;
  hasPermission?: () => Promise<boolean>;
  readInbox?: (limit: number) => Promise<InboxSmsRow[]>;
  readInboxBatch?: (
    minDateMs: number,
    maxDateMs: number,
    offset: number,
    limit: number,
  ) => Promise<InboxSmsRow[]>;
  readSenderSamples?: (
    minDateMs: number,
    recentFromMs: number,
    perSender: number,
  ) => Promise<{ sender: string; count: number; recentCount: number; rows: InboxSmsRow[] }[]>;
  readBankSenderBatch?: (
    sender: string,
    minDateMs: number,
    maxDateMs: number,
    offset: number,
    limit: number,
  ) => Promise<InboxSmsRow[]>;
  countInboxInRange?: (minDateMs: number, maxDateMs: number) => Promise<number>;
  countBankSenderInRange?: (
    sender: string,
    minDateMs: number,
    maxDateMs: number,
  ) => Promise<number>;
  findRecentInboxId?: (sender: string, body: string, withinMs: number) => Promise<string | null>;
  setVerifiedSenders?: (senders: string[]) => Promise<boolean>;
  drainPending?: () => Promise<Array<{ sender: string; body: string }>>;
  shouldRescan?: () => Promise<boolean>;
};

const { MaliSmsModule } = NativeModules as { MaliSmsModule?: SmsNative };

/** Quick rescan default (financial-filtered). Historical import uses paginated batches. */
export const SMS_INBOX_LIMIT = 500;

export type NormalizedInboxSms = {
  sourceSmsId?: string;
  sender: string;
  body: string;
  receivedAt: string;
  threadId?: string;
};

function mapRow(row: InboxSmsRow): NormalizedInboxSms {
  return {
    sourceSmsId: row.id,
    sender: row.sender,
    body: row.body,
    receivedAt: new Date(row.date).toISOString(),
    threadId: row.threadId,
  };
}

export async function requestSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }
  const result = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
    PermissionsAndroid.PERMISSIONS.READ_SMS,
  ]);
  return (
    result[PermissionsAndroid.PERMISSIONS.RECEIVE_SMS] === PermissionsAndroid.RESULTS.GRANTED &&
    result[PermissionsAndroid.PERMISSIONS.READ_SMS] === PermissionsAndroid.RESULTS.GRANTED
  );
}

export async function hasSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }
  if (!MaliSmsModule?.hasPermission) {
    return false;
  }
  try {
    return Boolean(await MaliSmsModule.hasPermission());
  } catch {
    return false;
  }
}

export async function readFinancialInbox(limit = SMS_INBOX_LIMIT): Promise<NormalizedInboxSms[]> {
  if (Platform.OS !== 'android' || !MaliSmsModule?.readInbox) {
    return [];
  }
  try {
    const rows = await MaliSmsModule.readInbox(limit);
    return (rows ?? []).map(mapRow);
  } catch {
    return [];
  }
}

export async function countInboxInRange(minDateMs: number, maxDateMs: number): Promise<number> {
  if (Platform.OS !== 'android' || !MaliSmsModule?.countInboxInRange) {
    return 0;
  }
  try {
    return (await MaliSmsModule.countInboxInRange(minDateMs, maxDateMs)) ?? 0;
  } catch {
    return 0;
  }
}

/** One page of inbox SMS in [minDateMs, maxDateMs]. No finance filter. ASC by date/_id. */
export async function readInboxBatch(input: {
  minDateMs: number;
  maxDateMs: number;
  offset: number;
  limit?: number;
}): Promise<NormalizedInboxSms[]> {
  if (Platform.OS !== 'android' || !MaliSmsModule?.readInboxBatch) {
    return [];
  }
  try {
    const rows = await MaliSmsModule.readInboxBatch(
      input.minDateMs,
      input.maxDateMs,
      input.offset,
      input.limit ?? 200,
    );
    return (rows ?? []).map(mapRow);
  } catch {
    return [];
  }
}

export type SenderSample = {
  sender: string;
  count: number;
  recentCount: number;
  rows: NormalizedInboxSms[];
};

/** Every sender since `minDateMs` with its counts and newest few messages, in one native pass. */
export async function readSenderSamples(input: {
  minDateMs: number;
  recentFromMs: number;
  perSender?: number;
}): Promise<SenderSample[]> {
  if (Platform.OS !== 'android' || !MaliSmsModule?.readSenderSamples) {
    return [];
  }
  try {
    const groups = await MaliSmsModule.readSenderSamples(
      input.minDateMs,
      input.recentFromMs,
      input.perSender ?? 5,
    );
    return (groups ?? []).map(g => ({ ...g, rows: (g.rows ?? []).map(mapRow) }));
  } catch {
    return [];
  }
}

/** ALL SMS from a known bank sender in range — no body keyword filter. */
export async function readBankSenderBatch(input: {
  sender: string;
  minDateMs: number;
  maxDateMs: number;
  offset: number;
  limit?: number;
}): Promise<NormalizedInboxSms[]> {
  if (Platform.OS !== 'android' || !MaliSmsModule?.readBankSenderBatch) {
    return [];
  }
  try {
    const rows = await MaliSmsModule.readBankSenderBatch(
      input.sender,
      input.minDateMs,
      input.maxDateMs,
      input.offset,
      input.limit ?? 200,
    );
    return (rows ?? []).map(mapRow);
  } catch {
    return [];
  }
}

export async function countBankSenderInRange(
  sender: string,
  minDateMs: number,
  maxDateMs: number,
): Promise<number> {
  if (Platform.OS !== 'android' || !MaliSmsModule?.countBankSenderInRange) {
    return 0;
  }
  try {
    return (await MaliSmsModule.countBankSenderInRange(sender, minDateMs, maxDateMs)) ?? 0;
  } catch {
    return 0;
  }
}

export async function findRecentInboxId(
  sender: string,
  body: string,
  withinMs = 60_000,
): Promise<string | undefined> {
  if (Platform.OS !== 'android' || !MaliSmsModule?.findRecentInboxId) {
    return undefined;
  }
  try {
    const id = await MaliSmsModule.findRecentInboxId(sender, body, withinMs);
    return id ?? undefined;
  } catch {
    return undefined;
  }
}

/** Push user-verified senders to native SharedPreferences for live SMS gate. */
export async function syncVerifiedSendersToNative(senders: string[]): Promise<void> {
  if (Platform.OS !== 'android' || !MaliSmsModule?.setVerifiedSenders) {
    return;
  }
  try {
    await MaliSmsModule.setVerifiedSenders(senders);
  } catch {
    // non-fatal
  }
}

export function subscribeIncomingSms(
  onSms: (payload: {
    sender: string;
    body: string;
    receivedAt?: string;
    sourceSmsId?: string;
  }) => void,
  options?: {
    onRescanNeeded?: () => void;
  },
) {
  if (!MaliSmsModule) {
    return () => undefined;
  }
  const emitter = new NativeEventEmitter(MaliSmsModule as never);
  const sub = emitter.addListener(
    'mali.sms.received',
    (payload: { sender?: string; body?: string; receivedAt?: string; sourceSmsId?: string }) => {
      if (!payload?.sender || !payload?.body) {
        return;
      }
      void (async () => {
        let sourceSmsId = payload.sourceSmsId;
        if (!sourceSmsId) {
          sourceSmsId = await findRecentInboxId(payload.sender!, payload.body!, 90_000);
        }
        onSms({
          sender: payload.sender!,
          body: payload.body!,
          receivedAt: payload.receivedAt,
          sourceSmsId,
        });
      })();
    },
  );
  MaliSmsModule.startListening?.();
  void (async () => {
    const stale = await MaliSmsModule.drainPending?.();
    for (const row of stale ?? []) {
      if (row?.sender && row?.body) {
        const sourceSmsId = await findRecentInboxId(row.sender, row.body, 120_000);
        onSms({ sender: row.sender, body: row.body, sourceSmsId });
      }
    }
    const rescan = await MaliSmsModule.shouldRescan?.();
    if (rescan) {
      options?.onRescanNeeded?.();
    }
  })();
  return () => {
    sub.remove();
    MaliSmsModule.stopListening?.();
  };
}
