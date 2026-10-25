import { emptySnapshot } from '../../../database/schema/snapshot';
import { ingestIncomingSms } from '../ingest';
import { addVerifiedSender } from '../senders/verified';

describe('ingestIncomingSms verified-sender mode', () => {
  test('TEST 16: unverified sender ignored; verified sender processed despite selectedBankIds', () => {
    const snapshot = emptySnapshot('u1');
    snapshot.settings.smsProcessingEnabled = true;
    snapshot.settings.selectedBankIds = ['melli'];
    snapshot.settings.bankConnections = addVerifiedSender([], 'mellat', '9909', 'user_selected_sms');

    const payload = {
      sender: '9909',
      body: 'بانک ملت\nواریز مبلغ 250000 ریال\nمانده 1000000',
      receivedAt: new Date().toISOString(),
      sourceSmsId: 'sms-mellat-1',
    };

    const live = ingestIncomingSms(snapshot, payload, { mode: 'live' });
    expect(live.kind).not.toBe('ignored');

    const other = ingestIncomingSms(
      snapshot,
      { ...payload, sender: '983000', sourceSmsId: 'sms-other' },
      { mode: 'live' },
    );
    expect(other.kind).toBe('ignored');
  });

  test('TEST 15: verified sender unfamiliar transactional body → unknown or non_transactional', () => {
    const snapshot = emptySnapshot('u1');
    snapshot.settings.smsProcessingEnabled = true;
    snapshot.settings.bankConnections = addVerifiedSender([], 'mellat', '9909', 'user_selected_sms');

    const result = ingestIncomingSms(
      snapshot,
      {
        sender: '9909',
        body: 'بانک ملت اطلاع رسانی عمومی بدون مبلغ مشخص',
        receivedAt: new Date().toISOString(),
        sourceSmsId: 'sms-odd-1',
      },
      { mode: 'incremental' },
    );

    expect(['unknown', 'non_transactional']).toContain(result.kind);
  });
});
