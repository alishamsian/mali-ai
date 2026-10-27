import type { StorageDriver } from '../../database/drivers/localDb';

/**
 * On-device crash log. Nothing is sent anywhere: the user can share it from
 * Settings → Support. Entries live in the encrypted store once it is open, and in
 * memory before that (a crash during boot is still kept for the session).
 */
export type CrashEntry = {
  at: string;
  /** 'render' = caught by an error boundary; 'global' = uncaught JS error. */
  kind: 'render' | 'global';
  fatal: boolean;
  message: string;
  stack?: string;
  componentStack?: string;
  /** Screen name for render errors, when known. */
  scope?: string;
};

const KEY = 'mali.crashlog.v1';
const MAX_ENTRIES = 20;
const MAX_STACK = 1_500;

let driver: StorageDriver | null = null;
let memory: CrashEntry[] = [];

function read(): CrashEntry[] {
  if (!driver) {
    return memory;
  }
  try {
    const raw = driver.get(KEY);
    return raw ? (JSON.parse(raw) as CrashEntry[]) : [];
  } catch {
    return [];
  }
}

function write(entries: CrashEntry[]): void {
  memory = entries;
  if (!driver) {
    return;
  }
  try {
    driver.set(KEY, JSON.stringify(entries));
  } catch {
    // Logging must never become the next crash.
  }
}

/** Called once the encrypted store is open; folds in anything logged before that. */
export function attachCrashLogStorage(next: StorageDriver): void {
  const early = memory;
  driver = next;
  if (early.length > 0) {
    write([...read(), ...early].slice(-MAX_ENTRIES));
  }
}

export function recordCrash(
  error: unknown,
  info: Omit<CrashEntry, 'at' | 'message' | 'stack'>,
): void {
  const err = error instanceof Error ? error : new Error(String(error));
  const entry: CrashEntry = {
    ...info,
    at: new Date().toISOString(),
    message: `${err.name}: ${err.message}`.slice(0, 300),
    stack: err.stack?.slice(0, MAX_STACK),
    componentStack: info.componentStack?.slice(0, MAX_STACK),
  };
  write([...read(), entry].slice(-MAX_ENTRIES));
}

export function getCrashLog(): CrashEntry[] {
  return read();
}

export function clearCrashLog(): void {
  write([]);
}

/** Plain-text report for the share sheet. */
export function formatCrashReport(entries: CrashEntry[], appVersion: string): string {
  const lines = [`Poolet ${appVersion} — ${entries.length} error(s)`];
  for (const e of entries) {
    lines.push(
      '',
      `[${e.at}] ${e.kind}${e.fatal ? ' fatal' : ''}${e.scope ? ` @ ${e.scope}` : ''}`,
      e.message,
    );
    if (e.stack) {
      lines.push(e.stack);
    }
    if (e.componentStack) {
      lines.push(`component stack:${e.componentStack}`);
    }
  }
  return lines.join('\n');
}

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;
type ErrorUtilsLike = {
  getGlobalHandler: () => GlobalHandler;
  setGlobalHandler: (handler: GlobalHandler) => void;
};

let installed = false;

/** Records uncaught JS errors, then hands them to React Native's own handler. */
export function installGlobalErrorHandler(): void {
  const utils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (installed || !utils) {
    return;
  }
  installed = true;
  const previous = utils.getGlobalHandler();
  utils.setGlobalHandler((error, isFatal) => {
    recordCrash(error, { kind: 'global', fatal: Boolean(isFatal) });
    previous(error, isFatal);
  });
}

export function __resetCrashLogForTests(): void {
  driver = null;
  memory = [];
  installed = false;
}
