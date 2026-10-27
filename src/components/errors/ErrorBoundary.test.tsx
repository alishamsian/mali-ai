import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { ErrorBoundary } from './ErrorBoundary';
import { MemoryStorage } from '../../database/drivers/memory';
import {
  __resetCrashLogForTests,
  attachCrashLogStorage,
  formatCrashReport,
  getCrashLog,
  installGlobalErrorHandler,
  recordCrash,
} from '../../services/crash/crashLog';
import { fa } from '../../i18n/fa';

let shouldThrow = true;
function Flaky() {
  if (shouldThrow) {
    throw new Error('boom in render');
  }
  return <Text>recovered</Text>;
}

beforeEach(() => {
  __resetCrashLogForTests();
  shouldThrow = true;
  // React logs caught render errors to console.error; keep test output readable.
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  (console.error as jest.Mock).mockRestore();
});

describe('ErrorBoundary', () => {
  it('shows a recoverable message instead of crashing, and logs the error', () => {
    const screen = render(
      <ErrorBoundary scope="Dashboard">
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByText(fa.crash.title)).toBeTruthy();

    const [entry] = getCrashLog();
    expect(entry).toMatchObject({ kind: 'render', scope: 'Dashboard', fatal: false });
    expect(entry.message).toContain('boom in render');
    expect(entry.componentStack).toContain('Flaky');
  });

  it('retry re-renders the children', () => {
    const screen = render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    );
    shouldThrow = false;
    fireEvent.press(screen.getByText(fa.crash.retry));
    expect(screen.getByText('recovered')).toBeTruthy();
  });

  it('keeps sibling boundaries working when one screen breaks', () => {
    const screen = render(
      <>
        <ErrorBoundary scope="Broken">
          <Flaky />
        </ErrorBoundary>
        <ErrorBoundary scope="Fine">
          <Text>other screen</Text>
        </ErrorBoundary>
      </>,
    );
    expect(screen.getByText('other screen')).toBeTruthy();
  });
});

describe('crash log', () => {
  it('keeps entries logged before storage opens and persists after', () => {
    recordCrash(new Error('early'), { kind: 'global', fatal: true });
    const storage = new MemoryStorage();
    attachCrashLogStorage(storage);
    recordCrash(new Error('late'), { kind: 'global', fatal: false });

    expect(getCrashLog().map(e => e.message)).toEqual(['Error: early', 'Error: late']);
    expect(storage.get('mali.crashlog.v1')).toContain('Error: late');
  });

  it('keeps only the most recent 20 entries', () => {
    for (let i = 0; i < 25; i += 1) {
      recordCrash(new Error(`e${i}`), { kind: 'global', fatal: false });
    }
    const log = getCrashLog();
    expect(log).toHaveLength(20);
    expect(log[0].message).toBe('Error: e5');
  });

  it('records uncaught errors and still calls the previous handler', () => {
    const previous = jest.fn();
    const utils = {
      handler: previous as (e: unknown, fatal?: boolean) => void,
      getGlobalHandler() {
        return this.handler;
      },
      setGlobalHandler(h: (e: unknown, fatal?: boolean) => void) {
        this.handler = h;
      },
    };
    const g = globalThis as { ErrorUtils?: unknown };
    const original = g.ErrorUtils;
    g.ErrorUtils = utils;
    try {
      installGlobalErrorHandler();
      const err = new Error('uncaught');
      utils.handler(err, true);
      expect(previous).toHaveBeenCalledWith(err, true);
      expect(getCrashLog()[0]).toMatchObject({ kind: 'global', fatal: true });
    } finally {
      g.ErrorUtils = original;
    }
  });

  it('formats a shareable report', () => {
    recordCrash(new Error('x'), { kind: 'render', fatal: false, scope: 'Vault' });
    const report = formatCrashReport(getCrashLog(), '1.15.0');
    expect(report).toContain('Poolet 1.15.0 — 1 error(s)');
    expect(report).toContain('render @ Vault');
  });
});
