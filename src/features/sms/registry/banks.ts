import {
  BANK_CATEGORY_ORDER,
  IRANIAN_BANK_CATALOG,
  type BankCatalogSeed,
  type BankCategory,
} from '../../banks/catalog';

export type BankRegistryStatus = 'needs-fixtures' | 'experimental' | 'active' | 'deprecated';

export type BankRegistryEntry = {
  id: string;
  nameFa: string;
  category: BankCategory;
  /** Known senders from verified fixtures only — never invent. */
  senders: string[];
  senderVerified: boolean;
  fixtureCount: number;
  status: BankRegistryStatus;
  strongKeywords: string[];
  weakKeywords: string[];
  legacyAliases: string[];
};

function toRegistryEntry(seed: BankCatalogSeed): BankRegistryEntry {
  return {
    id: seed.id,
    nameFa: seed.nameFa,
    category: seed.category,
    senders: seed.senders,
    senderVerified: seed.senderVerified ?? seed.senders.length > 0,
    fixtureCount: seed.fixtureCount ?? 0,
    status:
      seed.status ?? (seed.fixtureCount && seed.fixtureCount > 0 ? 'active' : 'needs-fixtures'),
    strongKeywords: seed.strongKeywords,
    weakKeywords: seed.weakKeywords,
    legacyAliases: seed.legacyAliases,
  };
}

export const BANK_REGISTRY: BankRegistryEntry[] = IRANIAN_BANK_CATALOG.map(toRegistryEntry);

export const SELECTABLE_BANK_IDS: string[] = BANK_REGISTRY.map(b => b.id);

export function getBankRegistry(bankId: string): BankRegistryEntry | undefined {
  return BANK_REGISTRY.find(b => b.id === bankId);
}

export function getBanksByCategory(): { category: BankCategory; banks: BankRegistryEntry[] }[] {
  return BANK_CATEGORY_ORDER.map(category => ({
    category,
    banks: BANK_REGISTRY.filter(b => b.category === category),
  })).filter(group => group.banks.length > 0);
}
