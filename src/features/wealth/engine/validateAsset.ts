import type { AssetClass, AssetDetails } from '../../../types/wealth';
import type { FaDict } from '../../../i18n/fa';

export type WealthFormContext = {
  assetClass: AssetClass;
  name: string;
  details: AssetDetails;
  bankBalanceToman?: number;
};

export function validateWealthForm(ctx: WealthFormContext, dict: FaDict): string | null {
  const { assetClass, name, details } = ctx;

  if (!name.trim() && assetClass !== 'bank') {
    return dict.accounts.assetInvalidTitle;
  }

  switch (details.class) {
    case 'cash': {
      if (details.amount <= 0) {
        return dict.accounts.assetInvalidBody;
      }
      if (!['IRT', 'IRR'].includes(details.currency) && !details.rateRial) {
        return dict.wealth.foreignCashNeedsRate;
      }
      break;
    }
    case 'bank': {
      if ((ctx.bankBalanceToman ?? 0) < 0) {
        return dict.accounts.assetInvalidBody;
      }
      break;
    }
    case 'gold':
    case 'silver': {
      if (details.weight <= 0 || details.currentPricePerUnitRial <= 0) {
        return dict.accounts.assetInvalidBody;
      }
      break;
    }
    case 'currency': {
      if (details.amount <= 0 || details.currentRateRial <= 0) {
        return dict.accounts.assetInvalidBody;
      }
      break;
    }
    case 'crypto': {
      if (details.quantity <= 0 || details.currentPriceRial <= 0) {
        return dict.accounts.assetInvalidBody;
      }
      break;
    }
    case 'stock':
    case 'fund': {
      const qty = details.class === 'stock' ? details.quantity : details.units;
      const price = details.class === 'stock' ? details.currentPriceRial : details.currentNavRial;
      if (qty <= 0 || price <= 0) {
        return dict.accounts.assetInvalidBody;
      }
      break;
    }
    case 'real_estate':
    case 'vehicle': {
      if (details.estimatedValueRial <= 0) {
        return dict.accounts.assetInvalidBody;
      }
      break;
    }
    case 'jewelry':
    case 'collectible': {
      if (details.estimatedValueRial <= 0) {
        return dict.accounts.assetInvalidBody;
      }
      break;
    }
    case 'other': {
      if (details.currentValueRial <= 0) {
        return dict.accounts.assetInvalidBody;
      }
      break;
    }
    case 'business': {
      if (details.estimatedBusinessValueRial <= 0) {
        return dict.accounts.assetInvalidBody;
      }
      break;
    }
  }

  return null;
}
