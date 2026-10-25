import { BANK_REGISTRY, SELECTABLE_BANK_IDS } from '../sms/registry/banks';
import { getAllKnownBankSenders } from '../sms/registry/senders';
import { resolveBankName } from './names';

describe('Iranian bank catalog', () => {
  it('includes all major operating banks plus legacy entries', () => {
    expect(SELECTABLE_BANK_IDS.length).toBeGreaterThanOrEqual(30);
    expect(BANK_REGISTRY.some(b => b.id === 'melli' && b.status === 'active')).toBe(true);
    expect(BANK_REGISTRY.some(b => b.id === 'blu')).toBe(true);
    expect(BANK_REGISTRY.some(b => b.id === 'resalat')).toBe(true);
  });

  it('resolves display names from registry', () => {
    expect(resolveBankName('parsian')).toBe('بانک پارسیان');
    expect(resolveBankName('unknown_xyz')).toBe('بانک');
  });

  it('builds sender alias index for every bank', () => {
    const senders = getAllKnownBankSenders();
    expect(senders).toContain('mellat');
    expect(senders).toContain('9830009417');
    expect(senders.length).toBeGreaterThan(40);
  });

  it('has IranianBankLogos assets for supported banks', () => {
    const { BANK_LOGO_SOURCES } = require('../../components/banks/bankLogos');
    expect(Object.keys(BANK_LOGO_SOURCES).length).toBe(28);
    expect(BANK_LOGO_SOURCES.melli).toBeDefined();
    expect(BANK_LOGO_SOURCES.mellat).toBeDefined();
  });
});
