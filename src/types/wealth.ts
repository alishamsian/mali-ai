/**
 * Wealth / Assets type system.
 * Extends existing FinancialAccount without breaking SMS-linked bank accounts.
 */

export type AssetClass =
  | 'cash'
  | 'bank'
  | 'gold'
  | 'silver'
  | 'currency'
  | 'crypto'
  | 'stock'
  | 'fund'
  | 'real_estate'
  | 'vehicle'
  | 'jewelry'
  | 'collectible'
  | 'business'
  | 'other';

export type AssetLiquidity = 'high' | 'medium' | 'low';

export type PriceSourceKind = 'manual' | 'provider';

export type ValueHistoryPoint = {
  date: string;
  valueRial: number;
  source: PriceSourceKind;
  note?: string;
};

export type NetWorthSnapshot = {
  date: string;
  assetsRial: number;
  liabilitiesRial: number;
  netWorthRial: number;
};

export type AllocationFilter = 'all' | 'investments' | 'liquid' | 'physical' | 'alternative';

export type WealthRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

/* ---------- Type-specific details ---------- */

export type CashDetails = {
  currency: string;
  amount: number;
  location?: string;
  /** نرخ تبدیل هر واحد ارز به ریال (نقد فیزیکی ارزی) */
  rateRial?: number;
};

export type BankAccountType = 'checking' | 'savings' | 'deposit' | 'short_term' | 'long_term';

export type BankDetails = {
  bankId?: string;
  accountTitle?: string;
  /** Masked — never store full PAN */
  accountNumberMasked?: string;
  cardLast4?: string;
  currency: string;
  accountType: BankAccountType;
};

export type GoldType =
  | 'melted'
  | 'emami'
  | 'bahar'
  | 'half'
  | 'quarter'
  | 'grami'
  | 'karat18'
  | 'karat24'
  | 'jewelry'
  | 'other';

export type GoldUnit = 'gram' | 'mithqal' | 'coin' | 'piece';

export type GoldDetails = {
  goldType: GoldType;
  weight: number;
  unit: GoldUnit;
  purity?: number;
  purchasePriceRial: number;
  purchaseDate?: string;
  currentPricePerUnitRial: number;
  location?: string;
};

export type SilverType = 'raw' | 'bar' | 'coin' | 'jewelry' | 'other';
export type SilverUnit = 'gram' | 'kilogram' | 'ounce';

export type SilverDetails = {
  silverType: SilverType;
  weight: number;
  unit: SilverUnit;
  purity: 999 | 925 | number;
  purchasePriceRial: number;
  purchaseDate?: string;
  currentPricePerUnitRial: number;
};

export type CurrencyLot = {
  id: string;
  amount: number;
  purchaseRateRial: number;
  purchaseDate?: string;
};

export type CurrencyDetails = {
  currencyCode: string;
  amount: number;
  averagePurchaseRateRial: number;
  currentRateRial: number;
  purchaseDate?: string;
  lots?: CurrencyLot[];
};

export type CryptoDetails = {
  symbol: string;
  name: string;
  quantity: number;
  averageBuyPriceRial: number;
  currentPriceRial: number;
  network?: string;
  venue?: string;
  /** Masked address only */
  addressMasked?: string;
};

export type StockMarket = 'iran' | 'us' | 'other';

export type StockDetails = {
  symbol: string;
  company: string;
  market: StockMarket;
  quantity: number;
  averagePurchasePriceRial: number;
  currentPriceRial: number;
  dividendRial?: number;
};

export type FundType = 'income' | 'equity' | 'mixed' | 'gold' | 'index' | 'other';

export type FundDetails = {
  fundName: string;
  fundType: FundType;
  units: number;
  purchaseNavRial: number;
  currentNavRial: number;
  managementCompany?: string;
};

export type PropertyType =
  | 'apartment'
  | 'house'
  | 'land'
  | 'commercial'
  | 'office'
  | 'warehouse'
  | 'other';

export type RealEstateDetails = {
  propertyType: PropertyType;
  city: string;
  areaSqm: number;
  ownershipPercent: number;
  purchasePriceRial: number;
  purchaseDate?: string;
  estimatedValueRial: number;
  mortgageRial?: number;
  monthlyRentRial?: number;
  addressPrivate?: string;
};

export type VehicleDetails = {
  brand: string;
  model: string;
  year: number;
  purchasePriceRial: number;
  purchaseDate?: string;
  estimatedValueRial: number;
  ownershipPercent: number;
  loanRial?: number;
  insuranceNote?: string;
};

export type JewelryCategory = 'ring' | 'necklace' | 'bracelet' | 'earring' | 'watch' | 'other';

export type JewelryDetails = {
  category: JewelryCategory;
  weight?: number;
  purity?: number;
  stone?: string;
  purchasePriceRial: number;
  estimatedValueRial: number;
  purchaseDate?: string;
  valueAsBullion?: boolean;
  photoUri?: string;
};

export type CollectibleCategory = 'art' | 'watch' | 'collectible' | 'antique' | 'other';

export type CollectibleDetails = {
  category: CollectibleCategory;
  purchasePriceRial: number;
  estimatedValueRial: number;
  purchaseDate?: string;
  condition?: string;
  photoUri?: string;
};

export type BusinessDetails = {
  businessName: string;
  ownershipPercent: number;
  estimatedBusinessValueRial: number;
  investmentAmountRial: number;
  profitDistributionRial?: number;
};

export type OtherDetails = {
  category?: string;
  purchaseValueRial: number;
  currentValueRial: number;
  purchaseDate?: string;
  photoUri?: string;
};

export type AssetDetails =
  | ({ class: 'cash' } & CashDetails)
  | ({ class: 'bank' } & BankDetails)
  | ({ class: 'gold' } & GoldDetails)
  | ({ class: 'silver' } & SilverDetails)
  | ({ class: 'currency' } & CurrencyDetails)
  | ({ class: 'crypto' } & CryptoDetails)
  | ({ class: 'stock' } & StockDetails)
  | ({ class: 'fund' } & FundDetails)
  | ({ class: 'real_estate' } & RealEstateDetails)
  | ({ class: 'vehicle' } & VehicleDetails)
  | ({ class: 'jewelry' } & JewelryDetails)
  | ({ class: 'collectible' } & CollectibleDetails)
  | ({ class: 'business' } & BusinessDetails)
  | ({ class: 'other' } & OtherDetails);

export type HoldingPerformance = {
  costBasisRial: number;
  currentValueRial: number;
  liabilityRial: number;
  netValueRial: number;
  unrealizedPlRial: number;
  unrealizedPlPct: number | null;
  supportsPl: boolean;
};
