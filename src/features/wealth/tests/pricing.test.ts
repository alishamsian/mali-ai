import { resolveUnitPriceRial, goldMarketSymbol, supportsLivePrice } from '../pricing/symbols';
import type { FinancialAccount } from '../../../types/finance';
import type { MarketBundle } from '../pricing/marketClient';

function account(partial: Partial<FinancialAccount>): FinancialAccount {
  const now = new Date().toISOString();
  return {
    id: 'a1',
    userId: 'u1',
    kind: 'asset',
    name: 't',
    balanceRial: 0,
    transactionCount: 0,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

const bundle: MarketBundle = {
  asOf: '2026-08-27T00:00:00.000Z',
  source: 'tgju',
  quotes: {
    gold_18: 20_000_000,
    gold_24: 26_000_000,
    gold_emami: 2_000_000_000,
    gold_mesghal: 92_000_000,
    usd: 2_000_000,
    silver_g: 4_000_000,
    btc: 100_000_000_000,
  },
};

describe('wealth live pricing symbols', () => {
  it('maps gold types to market symbols', () => {
    expect(goldMarketSymbol('karat18')).toBe('gold_18');
    expect(goldMarketSymbol('emami')).toBe('gold_emami');
    expect(goldMarketSymbol('karat24')).toBe('gold_24');
  });

  it('converts 5g of 18k gold to rial value via unit price', () => {
    const a = account({
      assetClass: 'gold',
      details: {
        class: 'gold',
        goldType: 'karat18',
        weight: 5,
        unit: 'gram',
        purchasePriceRial: 0,
        currentPricePerUnitRial: 0,
      },
    });
    expect(supportsLivePrice(a)).toBe(true);
    expect(resolveUnitPriceRial(a, bundle)).toBe(20_000_000);
  });

  it('resolves USD and BTC quotes', () => {
    const usd = account({
      assetClass: 'currency',
      details: {
        class: 'currency',
        currencyCode: 'USD',
        amount: 10,
        averagePurchaseRateRial: 0,
        currentRateRial: 0,
      },
    });
    expect(resolveUnitPriceRial(usd, bundle)).toBe(2_000_000);

    const btc = account({
      assetClass: 'crypto',
      details: {
        class: 'crypto',
        symbol: 'BTC',
        name: 'Bitcoin',
        quantity: 0.1,
        averageBuyPriceRial: 0,
        currentPriceRial: 0,
      },
    });
    expect(resolveUnitPriceRial(btc, bundle)).toBe(100_000_000_000);
  });
});
