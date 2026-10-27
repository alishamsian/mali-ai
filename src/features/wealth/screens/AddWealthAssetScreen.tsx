import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NightCanvas } from '../../../components/ui/NightCanvas';
import { AppText } from '../../../components/ui/AppText';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { BankPickerField } from '../../banks/components/BankPickerField';
import { OptionPickerField } from '../../../components/ui/OptionPickerField';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { interpolate, t } from '../../../i18n';
import { formatTomanFromRial, tomanToRial, rialToToman } from '../../../utils/currency/money';
import { AmountField } from '../../../components/ui/AmountInput';
import {
  parseIntegerAmount,
  sanitizeAmountDigits,
  toEnglishDigits,
  toPersianDigits,
} from '../../../utils/numbers/digits';
import { useFinanceStore } from '../../../store/finance/store';
import type { RootStackParamList } from '../../../app/navigation/types';
import type {
  AssetClass,
  AssetDetails,
  BankAccountType,
  GoldType,
  GoldUnit,
} from '../../../types/wealth';
import { ASSET_CLASS_META, ASSET_CLASS_ORDER } from '../catalog/classes';
import type { FinancialAccount } from '../../../types/finance';
import { fetchLiveUnitPrice } from '../pricing/providers';
import { currencyMarketSymbol, goldMarketSymbol } from '../pricing/symbols';
import { validateWealthForm } from '../engine/validateAsset';
import type { PriceSourceKind } from '../../../types/wealth';

type FieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'number-pad';
  kind?: 'text' | 'amount' | 'decimal';
};

/** Amount fields get their own component so hooks never run conditionally. */
function Field(props: FieldProps) {
  if (props.kind === 'amount') {
    return (
      <AmountField
        label={props.label}
        value={props.value}
        onChangeValue={props.onChange}
        placeholder={props.placeholder}
      />
    );
  }
  return <PlainField {...props} />;
}

function PlainField({
  label,
  value,
  onChange,
  placeholder,
  keyboardType = 'default',
  kind = 'text',
}: FieldProps) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(c => ({
    field: { gap: 6 },
    label: { textAlign: 'right', color: c.textMuted, fontSize: 12 },
    input: {
      minHeight: 46,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      color: c.text,
      paddingHorizontal: 14,
      backgroundColor: c.surface,
    },
  }));

  const displayValue = kind === 'decimal' && value ? toPersianDigits(value) : value;

  return (
    <View style={styles.field}>
      <AppText style={styles.label}>{label}</AppText>
      <TextInput
        value={displayValue}
        onChangeText={v => onChange(kind === 'decimal' ? decimalInput(v) : v)}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={kind === 'decimal' ? 'decimal-pad' : keyboardType}
        textAlign="right"
        style={styles.input}
      />
    </View>
  );
}

function digitsOnly(v: string) {
  return sanitizeAmountDigits(v);
}

function decimalInput(v: string) {
  const en = toEnglishDigits(v).replace(/[^\d.]/g, '');
  const [a, ...rest] = en.split('.');
  return rest.length ? `${a}.${rest.join('').slice(0, 6)}` : a;
}

export function AddWealthAssetScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'AddWealthAsset'>>();
  const { colors, mode } = useAppTheme();
  const isLight = mode === 'light';
  const chipBg = isLight ? 'rgba(8,13,16,0.04)' : 'rgba(255,255,255,0.04)';
  const styles = useThemedStyles((c, th) => ({
    header: {
      flexDirection: 'row-reverse',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    prompt: {
      textAlign: 'right',
      fontSize: 20,
      fontFamily: th.typography.fontFamily.semibold,
      color: c.text,
      marginBottom: 16,
    },
    grid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
    tile: {
      width: '47%',
      borderRadius: 16,
      paddingVertical: 16,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: chipBg,
      alignItems: 'flex-end',
      gap: 8,
    },
    tileDot: { width: 8, height: 8, borderRadius: 4 },
    tileText: { color: c.text, fontSize: 14, textAlign: 'right' },
    form: { gap: 10 },
    formClass: {
      textAlign: 'right',
      color: c.primary,
      fontFamily: th.typography.fontFamily.semibold,
      marginBottom: 4,
    },
    banks: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
    bankChip: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },
    chipOn: { borderColor: c.primary, backgroundColor: th.palette.primaryGlow },
    hint: { textAlign: 'right', color: c.textMuted, fontSize: 11, lineHeight: 18 },
    formError: { textAlign: 'center', color: c.expense, fontSize: 13, marginTop: 8 },
  }));
  const dict = t();
  const snapshot = useFinanceStore(s => s.snapshot);
  const upsert = useFinanceStore(s => s.upsertAccount);

  const editing = useMemo(() => {
    const id = route.params?.id;
    return id ? snapshot.accounts.find(a => a.id === id) : undefined;
  }, [route.params?.id, snapshot.accounts]);

  const [step, setStep] = useState<'pick' | 'form'>(
    editing || route.params?.assetClass ? 'form' : 'pick',
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [assetClass, setAssetClass] = useState<AssetClass>(
    route.params?.assetClass ?? editing?.assetClass ?? 'gold',
  );

  // shared
  const [name, setName] = useState(editing?.name ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');

  // cash
  const [cashAmount, setCashAmount] = useState(
    editing?.details?.class === 'cash' ? String(editing.details.amount) : '',
  );
  const [cashCurrency, setCashCurrency] = useState(
    editing?.details?.class === 'cash' ? editing.details.currency : 'IRT',
  );
  const [cashLocation, setCashLocation] = useState(
    editing?.details?.class === 'cash' ? editing.details.location ?? '' : '',
  );

  // bank
  const [bankId, setBankId] = useState(editing?.bankId ?? 'melli');
  const [last4, setLast4] = useState(editing?.cardLast4 ?? '');
  const [bankBalance, setBankBalance] = useState(
    editing && (editing.kind === 'bank' || editing.kind === 'card')
      ? String(rialToToman(editing.balanceRial))
      : '',
  );
  const [accountType, setAccountType] = useState<BankAccountType>(
    editing?.details?.class === 'bank' ? editing.details.accountType : 'checking',
  );

  // gold
  const [goldType, setGoldType] = useState<GoldType>(
    editing?.details?.class === 'gold' ? editing.details.goldType : 'karat18',
  );
  const [goldUnit, setGoldUnit] = useState<GoldUnit>(
    editing?.details?.class === 'gold' ? editing.details.unit : 'gram',
  );
  const [goldWeight, setGoldWeight] = useState(
    editing?.details?.class === 'gold' ? String(editing.details.weight) : '',
  );
  const [goldPurity, setGoldPurity] = useState(
    editing?.details?.class === 'gold' && editing.details.purity != null
      ? String(editing.details.purity)
      : '750',
  );
  const [goldPurchase, setGoldPurchase] = useState(
    editing?.details?.class === 'gold'
      ? String(rialToToman(editing.details.purchasePriceRial))
      : '',
  );
  const [goldUnitPrice, setGoldUnitPrice] = useState(
    editing?.details?.class === 'gold'
      ? String(rialToToman(editing.details.currentPricePerUnitRial))
      : '',
  );

  // silver
  const [silverWeight, setSilverWeight] = useState(
    editing?.details?.class === 'silver' ? String(editing.details.weight) : '',
  );
  const [silverPurchase, setSilverPurchase] = useState(
    editing?.details?.class === 'silver'
      ? String(rialToToman(editing.details.purchasePriceRial))
      : '',
  );
  const [silverUnitPrice, setSilverUnitPrice] = useState(
    editing?.details?.class === 'silver'
      ? String(rialToToman(editing.details.currentPricePerUnitRial))
      : '',
  );

  // currency
  const [fxCode, setFxCode] = useState(
    editing?.details?.class === 'currency' ? editing.details.currencyCode : 'USD',
  );
  const [fxAmount, setFxAmount] = useState(
    editing?.details?.class === 'currency' ? String(editing.details.amount) : '',
  );
  const [fxBuy, setFxBuy] = useState(
    editing?.details?.class === 'currency'
      ? String(rialToToman(editing.details.averagePurchaseRateRial))
      : '',
  );
  const [fxNow, setFxNow] = useState(
    editing?.details?.class === 'currency'
      ? String(rialToToman(editing.details.currentRateRial))
      : '',
  );

  // crypto
  const [cryptoSymbol, setCryptoSymbol] = useState(
    editing?.details?.class === 'crypto' ? editing.details.symbol : 'BTC',
  );
  const [cryptoQty, setCryptoQty] = useState(
    editing?.details?.class === 'crypto' ? String(editing.details.quantity) : '',
  );
  const [cryptoBuy, setCryptoBuy] = useState(
    editing?.details?.class === 'crypto'
      ? String(rialToToman(editing.details.averageBuyPriceRial))
      : '',
  );
  const [cryptoNow, setCryptoNow] = useState(
    editing?.details?.class === 'crypto'
      ? String(rialToToman(editing.details.currentPriceRial))
      : '',
  );
  const [cryptoVenue, setCryptoVenue] = useState(
    editing?.details?.class === 'crypto' ? editing.details.venue ?? '' : '',
  );

  // stock
  const [stockSymbol, setStockSymbol] = useState(
    editing?.details?.class === 'stock' ? editing.details.symbol : '',
  );
  const [stockCompany, setStockCompany] = useState(
    editing?.details?.class === 'stock' ? editing.details.company : '',
  );
  const [stockQty, setStockQty] = useState(
    editing?.details?.class === 'stock' ? String(editing.details.quantity) : '',
  );
  const [stockBuy, setStockBuy] = useState(
    editing?.details?.class === 'stock'
      ? String(rialToToman(editing.details.averagePurchasePriceRial))
      : '',
  );
  const [stockNow, setStockNow] = useState(
    editing?.details?.class === 'stock'
      ? String(rialToToman(editing.details.currentPriceRial))
      : '',
  );

  // fund
  const [fundName, setFundName] = useState(
    editing?.details?.class === 'fund' ? editing.details.fundName : '',
  );
  const [fundUnits, setFundUnits] = useState(
    editing?.details?.class === 'fund' ? String(editing.details.units) : '',
  );
  const [fundBuyNav, setFundBuyNav] = useState(
    editing?.details?.class === 'fund' ? String(rialToToman(editing.details.purchaseNavRial)) : '',
  );
  const [fundNav, setFundNav] = useState(
    editing?.details?.class === 'fund' ? String(rialToToman(editing.details.currentNavRial)) : '',
  );

  // real estate
  const [reCity, setReCity] = useState(
    editing?.details?.class === 'real_estate' ? editing.details.city : '',
  );
  const [reArea, setReArea] = useState(
    editing?.details?.class === 'real_estate' ? String(editing.details.areaSqm) : '',
  );
  const [reOwn, setReOwn] = useState(
    editing?.details?.class === 'real_estate' ? String(editing.details.ownershipPercent) : '100',
  );
  const [rePurchase, setRePurchase] = useState(
    editing?.details?.class === 'real_estate'
      ? String(rialToToman(editing.details.purchasePriceRial))
      : '',
  );
  const [reValue, setReValue] = useState(
    editing?.details?.class === 'real_estate'
      ? String(rialToToman(editing.details.estimatedValueRial))
      : '',
  );
  const [reMortgage, setReMortgage] = useState(
    editing?.details?.class === 'real_estate' && editing.details.mortgageRial
      ? String(rialToToman(editing.details.mortgageRial))
      : '',
  );

  // vehicle
  const [vBrand, setVBrand] = useState(
    editing?.details?.class === 'vehicle' ? editing.details.brand : '',
  );
  const [vModel, setVModel] = useState(
    editing?.details?.class === 'vehicle' ? editing.details.model : '',
  );
  const [vYear, setVYear] = useState(
    editing?.details?.class === 'vehicle' ? String(editing.details.year) : '',
  );
  const [vPurchase, setVPurchase] = useState(
    editing?.details?.class === 'vehicle'
      ? String(rialToToman(editing.details.purchasePriceRial))
      : '',
  );
  const [vValue, setVValue] = useState(
    editing?.details?.class === 'vehicle'
      ? String(rialToToman(editing.details.estimatedValueRial))
      : '',
  );

  // jewelry / collectible / business / other
  const [purchaseValue, setPurchaseValue] = useState(
    editing?.costBasisRial != null ? String(rialToToman(editing.costBasisRial)) : '',
  );
  const [currentValue, setCurrentValue] = useState(
    editing ? String(rialToToman(editing.balanceRial)) : '',
  );
  const [bizOwn, setBizOwn] = useState(
    editing?.details?.class === 'business' ? String(editing.details.ownershipPercent) : '15',
  );
  const [bizVal, setBizVal] = useState(
    editing?.details?.class === 'business'
      ? String(rialToToman(editing.details.estimatedBusinessValueRial))
      : '',
  );
  const [bizInvest, setBizInvest] = useState(
    editing?.details?.class === 'business'
      ? String(rialToToman(editing.details.investmentAmountRial))
      : '',
  );

  const [liveHint, setLiveHint] = useState('');
  const manualGoldPrice = useRef(Boolean(editing?.details?.class === 'gold'));
  const manualSilverPrice = useRef(Boolean(editing?.details?.class === 'silver'));
  const manualFxPrice = useRef(Boolean(editing?.details?.class === 'currency'));
  const manualCryptoPrice = useRef(Boolean(editing?.details?.class === 'crypto'));

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (assetClass === 'gold') {
          const sym = goldUnit === 'mithqal' ? 'gold_mesghal' : goldMarketSymbol(goldType);
          const q = await fetchLiveUnitPrice(sym);
          if (cancelled) {
            return;
          }
          if (!q) {
            setLiveHint(dict.wealth.liveFailed);
            return;
          }
          if (!manualGoldPrice.current) {
            setGoldUnitPrice(String(rialToToman(q.priceRial)));
          }
          const w = Number(toEnglishDigits(goldWeight)) || 0;
          if (w > 0) {
            setLiveHint(
              interpolate(dict.wealth.liveEstimate, {
                value: formatTomanFromRial(Math.round(w * q.priceRial)),
              }),
            );
          } else {
            setLiveHint(
              interpolate(dict.wealth.liveUnit, {
                value: formatTomanFromRial(q.priceRial),
              }),
            );
          }
          return;
        }
        if (assetClass === 'silver') {
          const q = await fetchLiveUnitPrice('silver_g');
          if (cancelled) {
            return;
          }
          if (!q) {
            setLiveHint(dict.wealth.liveFailed);
            return;
          }
          if (!manualSilverPrice.current) {
            setSilverUnitPrice(String(rialToToman(q.priceRial)));
          }
          const w = Number(toEnglishDigits(silverWeight)) || 0;
          setLiveHint(
            w > 0
              ? interpolate(dict.wealth.liveEstimate, {
                  value: formatTomanFromRial(Math.round(w * q.priceRial)),
                })
              : interpolate(dict.wealth.liveUnit, {
                  value: formatTomanFromRial(q.priceRial),
                }),
          );
          return;
        }
        if (assetClass === 'currency') {
          const q = await fetchLiveUnitPrice(fxCode.toLowerCase());
          if (cancelled) {
            return;
          }
          if (!q) {
            setLiveHint(dict.wealth.liveFailed);
            return;
          }
          if (!manualFxPrice.current) {
            setFxNow(String(rialToToman(q.priceRial)));
          }
          const amt = Number(toEnglishDigits(fxAmount)) || 0;
          setLiveHint(
            amt > 0
              ? interpolate(dict.wealth.liveEstimate, {
                  value: formatTomanFromRial(Math.round(amt * q.priceRial)),
                })
              : interpolate(dict.wealth.liveUnit, {
                  value: formatTomanFromRial(q.priceRial),
                }),
          );
          return;
        }
        if (assetClass === 'crypto') {
          const q = await fetchLiveUnitPrice(cryptoSymbol.toLowerCase());
          if (cancelled) {
            return;
          }
          if (!q) {
            setLiveHint(dict.wealth.liveFailed);
            return;
          }
          if (!manualCryptoPrice.current) {
            setCryptoNow(String(rialToToman(q.priceRial)));
          }
          const qty = Number(toEnglishDigits(cryptoQty)) || 0;
          setLiveHint(
            qty > 0
              ? interpolate(dict.wealth.liveEstimate, {
                  value: formatTomanFromRial(Math.round(qty * q.priceRial)),
                })
              : interpolate(dict.wealth.liveUnit, {
                  value: formatTomanFromRial(q.priceRial),
                }),
          );
          return;
        }
        setLiveHint('');
      } catch {
        if (!cancelled) {
          setLiveHint(dict.wealth.liveFailed);
        }
      }
    };
    setLiveHint(dict.wealth.liveLoading);
    const tmr = setTimeout(() => {
      void run();
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(tmr);
    };
  }, [
    assetClass,
    goldType,
    goldUnit,
    goldWeight,
    silverWeight,
    fxCode,
    fxAmount,
    cryptoSymbol,
    cryptoQty,
    dict.wealth.liveEstimate,
    dict.wealth.liveFailed,
    dict.wealth.liveLoading,
    dict.wealth.liveUnit,
  ]);

  const pickClass = (cls: AssetClass) => {
    setAssetClass(cls);
    manualGoldPrice.current = false;
    manualSilverPrice.current = false;
    manualFxPrice.current = false;
    manualCryptoPrice.current = false;
    if (!name.trim()) {
      setName(dict.wealth.classes[cls]);
    }
    setStep('form');
  };

  const buildDetails = (): AssetDetails => {
    switch (assetClass) {
      case 'cash':
        return {
          class: 'cash',
          currency: cashCurrency,
          amount: Number(toEnglishDigits(cashAmount)) || 0,
          location: cashLocation || undefined,
        };
      case 'bank':
        return {
          class: 'bank',
          bankId,
          accountTitle: name,
          cardLast4: last4 || undefined,
          currency: 'IRT',
          accountType,
        };
      case 'gold':
        return {
          class: 'gold',
          goldType,
          weight: Number(toEnglishDigits(goldWeight)) || 0,
          unit: goldUnit,
          purity: Number(toEnglishDigits(goldPurity)) || undefined,
          purchasePriceRial: tomanToRial(parseIntegerAmount(goldPurchase) ?? 0),
          currentPricePerUnitRial: tomanToRial(parseIntegerAmount(goldUnitPrice) ?? 0),
        };
      case 'silver':
        return {
          class: 'silver',
          silverType: 'raw',
          weight: Number(toEnglishDigits(silverWeight)) || 0,
          unit: 'gram',
          purity: 999,
          purchasePriceRial: tomanToRial(parseIntegerAmount(silverPurchase) ?? 0),
          currentPricePerUnitRial: tomanToRial(parseIntegerAmount(silverUnitPrice) ?? 0),
        };
      case 'currency':
        return {
          class: 'currency',
          currencyCode: fxCode,
          amount: Number(toEnglishDigits(fxAmount)) || 0,
          averagePurchaseRateRial: tomanToRial(parseIntegerAmount(fxBuy) ?? 0),
          currentRateRial: tomanToRial(parseIntegerAmount(fxNow) ?? 0),
        };
      case 'crypto':
        return {
          class: 'crypto',
          symbol: cryptoSymbol.toUpperCase(),
          name: name || cryptoSymbol,
          quantity: Number(toEnglishDigits(cryptoQty)) || 0,
          averageBuyPriceRial: tomanToRial(parseIntegerAmount(cryptoBuy) ?? 0),
          currentPriceRial: tomanToRial(parseIntegerAmount(cryptoNow) ?? 0),
          venue: cryptoVenue || undefined,
        };
      case 'stock':
        return {
          class: 'stock',
          symbol: stockSymbol,
          company: stockCompany || stockSymbol,
          market: 'iran',
          quantity: Number(toEnglishDigits(stockQty)) || 0,
          averagePurchasePriceRial: tomanToRial(parseIntegerAmount(stockBuy) ?? 0),
          currentPriceRial: tomanToRial(parseIntegerAmount(stockNow) ?? 0),
        };
      case 'fund':
        return {
          class: 'fund',
          fundName: fundName || name,
          fundType: 'mixed',
          units: Number(toEnglishDigits(fundUnits)) || 0,
          purchaseNavRial: tomanToRial(parseIntegerAmount(fundBuyNav) ?? 0),
          currentNavRial: tomanToRial(parseIntegerAmount(fundNav) ?? 0),
        };
      case 'real_estate':
        return {
          class: 'real_estate',
          propertyType: 'apartment',
          city: reCity || '—',
          areaSqm: Number(toEnglishDigits(reArea)) || 0,
          ownershipPercent: Number(toEnglishDigits(reOwn)) || 100,
          purchasePriceRial: tomanToRial(parseIntegerAmount(rePurchase) ?? 0),
          estimatedValueRial: tomanToRial(parseIntegerAmount(reValue) ?? 0),
          mortgageRial: reMortgage ? tomanToRial(parseIntegerAmount(reMortgage) ?? 0) : undefined,
        };
      case 'vehicle':
        return {
          class: 'vehicle',
          brand: vBrand || '—',
          model: vModel || '—',
          year: Number(toEnglishDigits(vYear)) || 1400,
          purchasePriceRial: tomanToRial(parseIntegerAmount(vPurchase) ?? 0),
          estimatedValueRial: tomanToRial(parseIntegerAmount(vValue) ?? 0),
          ownershipPercent: 100,
        };
      case 'jewelry':
        return {
          class: 'jewelry',
          category: 'other',
          purchasePriceRial: tomanToRial(parseIntegerAmount(purchaseValue) ?? 0),
          estimatedValueRial: tomanToRial(parseIntegerAmount(currentValue) ?? 0),
        };
      case 'collectible':
        return {
          class: 'collectible',
          category: 'other',
          purchasePriceRial: tomanToRial(parseIntegerAmount(purchaseValue) ?? 0),
          estimatedValueRial: tomanToRial(parseIntegerAmount(currentValue) ?? 0),
        };
      case 'business':
        return {
          class: 'business',
          businessName: name,
          ownershipPercent: Number(toEnglishDigits(bizOwn)) || 0,
          estimatedBusinessValueRial: tomanToRial(parseIntegerAmount(bizVal) ?? 0),
          investmentAmountRial: tomanToRial(parseIntegerAmount(bizInvest) ?? 0),
        };
      default:
        return {
          class: 'other',
          purchaseValueRial: tomanToRial(parseIntegerAmount(purchaseValue) ?? 0),
          currentValueRial: tomanToRial(parseIntegerAmount(currentValue) ?? 0),
        };
    }
  };

  const save = async () => {
    setFormError(null);
    const now = new Date().toISOString();
    let details = buildDetails();

    if (details.class === 'cash' && !['IRT', 'IRR'].includes(details.currency)) {
      const existingRate =
        editing?.details?.class === 'cash' ? editing.details.rateRial : undefined;
      const quote = await fetchLiveUnitPrice(currencyMarketSymbol(details.currency));
      const rateRial = quote?.priceRial ?? existingRate;
      if (!rateRial) {
        setFormError(dict.wealth.foreignCashNeedsRate);
        return;
      }
      details = { ...details, rateRial };
    }

    const validationError = validateWealthForm(
      {
        assetClass,
        name,
        details,
        bankBalanceToman: parseIntegerAmount(bankBalance) ?? 0,
      },
      dict,
    );
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const meta = ASSET_CLASS_META[assetClass];
    const kind: FinancialAccount['kind'] =
      assetClass === 'bank' ? 'bank' : assetClass === 'cash' ? 'cash' : 'asset';

    let priceSource: PriceSourceKind = 'manual';
    if (assetClass === 'gold' && !manualGoldPrice.current) {
      priceSource = 'provider';
    } else if (assetClass === 'silver' && !manualSilverPrice.current) {
      priceSource = 'provider';
    } else if (assetClass === 'currency' && !manualFxPrice.current) {
      priceSource = 'provider';
    } else if (assetClass === 'crypto' && !manualCryptoPrice.current) {
      priceSource = 'provider';
    }

    const base: FinancialAccount = {
      id: editing?.id ?? `acc_${Date.now()}`,
      userId: snapshot.profile.id,
      kind,
      bankId: assetClass === 'bank' ? bankId : assetClass === 'cash' ? 'cash' : undefined,
      name: name.trim() || dict.wealth.classes[assetClass],
      cardLast4: assetClass === 'bank' ? last4 || undefined : undefined,
      balanceRial:
        assetClass === 'bank'
          ? tomanToRial(parseIntegerAmount(bankBalance) ?? 0)
          : editing?.balanceRial ?? 0,
      transactionCount: editing?.transactionCount ?? 0,
      createdAt: editing?.createdAt ?? now,
      updatedAt: now,
      assetClass,
      details,
      liquidity: meta.defaultLiquidity,
      priceSource,
      priceUpdatedAt: now,
      notes: notes.trim() || undefined,
      costBasisRial: editing?.costBasisRial,
      liabilityRial: editing?.liabilityRial ?? 0,
      valueHistory: editing?.valueHistory,
    };

    upsert(base);
    nav.goBack();
  };

  return (
    <NightCanvas>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 16,
        }}
        keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => (step === 'form' && !editing ? setStep('pick') : nav.goBack())}>
            <AppText style={{ color: colors.textMuted }}>{dict.common.back}</AppText>
          </Pressable>
          <AppText variant="label">
            {editing ? dict.wealth.editAsset : dict.wealth.addAsset}
          </AppText>
          <View style={{ width: 48 }} />
        </View>

        {step === 'pick' ? (
          <>
            <AppText style={styles.prompt}>{dict.wealth.whatToAdd}</AppText>
            <View style={styles.grid}>
              {ASSET_CLASS_ORDER.map(cls => (
                <Pressable
                  key={cls}
                  onPress={() => pickClass(cls)}
                  style={[styles.tile, { backgroundColor: ASSET_CLASS_META[cls].accentMuted }]}>
                  <View
                    style={[styles.tileDot, { backgroundColor: ASSET_CLASS_META[cls].accent }]}
                  />
                  <AppText style={styles.tileText}>{dict.wealth.classes[cls]}</AppText>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <View style={styles.form}>
            <AppText style={styles.formClass}>{dict.wealth.classes[assetClass]}</AppText>
            <Field label={dict.accounts.nameField} value={name} onChange={setName} />

            {assetClass === 'cash' ? (
              <>
                <OptionPickerField
                  label={dict.wealth.fields.currency}
                  options={['IRT', 'USD', 'EUR', 'GBP', 'AED']}
                  value={cashCurrency}
                  onChange={setCashCurrency}
                  labelOf={v => v}
                  searchable={false}
                />
                <Field
                  label={dict.wealth.fields.amount}
                  value={cashAmount}
                  onChange={v => setCashAmount(decimalInput(v))}
                  kind="decimal"
                />
                <Field
                  label={dict.wealth.fields.location}
                  value={cashLocation}
                  onChange={setCashLocation}
                />
              </>
            ) : null}

            {assetClass === 'bank' ? (
              <>
                <BankPickerField
                  selectedId={bankId}
                  onSelect={setBankId}
                  searchPlaceholder={dict.sms.searchBank}
                />
                <OptionPickerField
                  label={dict.wealth.fields.accountType}
                  options={
                    [
                      'checking',
                      'savings',
                      'deposit',
                      'short_term',
                      'long_term',
                    ] as BankAccountType[]
                  }
                  value={accountType}
                  onChange={setAccountType}
                  labelOf={v => dict.wealth.bankTypes[v]}
                />
                <Field
                  label={dict.accounts.card}
                  value={last4}
                  onChange={v => setLast4(digitsOnly(v).slice(-4))}
                  keyboardType="number-pad"
                />
                <Field
                  label={dict.accounts.balanceField}
                  value={bankBalance}
                  onChange={setBankBalance}
                  kind="amount"
                />
              </>
            ) : null}

            {assetClass === 'gold' ? (
              <>
                <OptionPickerField
                  label={dict.wealth.fields.goldType}
                  options={
                    [
                      'melted',
                      'emami',
                      'bahar',
                      'half',
                      'quarter',
                      'grami',
                      'karat18',
                      'karat24',
                      'jewelry',
                      'other',
                    ] as GoldType[]
                  }
                  value={goldType}
                  onChange={setGoldType}
                  labelOf={v => dict.wealth.goldTypes[v]}
                />
                <OptionPickerField
                  label={dict.wealth.fields.goldUnit}
                  options={['gram', 'mithqal', 'coin', 'piece'] as GoldUnit[]}
                  value={goldUnit}
                  onChange={setGoldUnit}
                  labelOf={v => dict.wealth.goldUnits[v]}
                  searchable={false}
                />
                <Field
                  label={dict.wealth.fields.weight}
                  value={goldWeight}
                  onChange={v => setGoldWeight(decimalInput(v))}
                  kind="decimal"
                />
                <Field
                  label={dict.wealth.fields.purity}
                  value={goldPurity ? toPersianDigits(goldPurity) : ''}
                  onChange={v => setGoldPurity(digitsOnly(v))}
                  keyboardType="number-pad"
                />
                <Field
                  label={dict.wealth.fields.purchasePrice}
                  value={goldPurchase}
                  onChange={setGoldPurchase}
                  kind="amount"
                />
                <Field
                  label={dict.wealth.fields.unitPrice}
                  value={goldUnitPrice}
                  onChange={v => {
                    manualGoldPrice.current = true;
                    setGoldUnitPrice(v);
                  }}
                  kind="amount"
                />
                {liveHint ? <AppText style={styles.hint}>{liveHint}</AppText> : null}
                <AppText style={styles.hint}>{dict.wealth.priceHint}</AppText>
              </>
            ) : null}

            {assetClass === 'silver' ? (
              <>
                <Field
                  label={dict.wealth.fields.weightGram}
                  value={silverWeight}
                  onChange={v => setSilverWeight(decimalInput(v))}
                  kind="decimal"
                />
                <Field
                  label={dict.wealth.fields.purchasePrice}
                  value={silverPurchase}
                  onChange={setSilverPurchase}
                  kind="amount"
                />
                <Field
                  label={dict.wealth.fields.spotPerGram}
                  value={silverUnitPrice}
                  onChange={v => {
                    manualSilverPrice.current = true;
                    setSilverUnitPrice(v);
                  }}
                  kind="amount"
                />
                {liveHint ? <AppText style={styles.hint}>{liveHint}</AppText> : null}
              </>
            ) : null}

            {assetClass === 'currency' ? (
              <>
                <OptionPickerField
                  label={dict.wealth.fields.currency}
                  options={['USD', 'EUR', 'GBP', 'AED', 'TRY']}
                  value={fxCode}
                  onChange={setFxCode}
                  labelOf={v => v}
                  searchable={false}
                />
                <Field
                  label={dict.wealth.fields.fxAmount}
                  value={fxAmount}
                  onChange={v => setFxAmount(decimalInput(v))}
                  kind="decimal"
                />
                <Field
                  label={dict.wealth.fields.avgRate}
                  value={fxBuy}
                  onChange={setFxBuy}
                  kind="amount"
                />
                <Field
                  label={dict.wealth.fields.currentRate}
                  value={fxNow}
                  onChange={v => {
                    manualFxPrice.current = true;
                    setFxNow(v);
                  }}
                  kind="amount"
                />
                {liveHint ? <AppText style={styles.hint}>{liveHint}</AppText> : null}
              </>
            ) : null}

            {assetClass === 'crypto' ? (
              <>
                <OptionPickerField
                  label={dict.wealth.fields.symbol}
                  options={['BTC', 'ETH', 'USDT', 'SOL']}
                  value={cryptoSymbol}
                  onChange={setCryptoSymbol}
                  labelOf={v => v}
                  searchable={false}
                />
                <Field
                  label={dict.wealth.fields.quantity}
                  value={cryptoQty}
                  onChange={v => setCryptoQty(decimalInput(v))}
                  kind="decimal"
                />
                <Field
                  label={dict.wealth.fields.avgBuy}
                  value={cryptoBuy}
                  onChange={setCryptoBuy}
                  kind="amount"
                />
                <Field
                  label={dict.wealth.fields.currentPrice}
                  value={cryptoNow}
                  onChange={v => {
                    manualCryptoPrice.current = true;
                    setCryptoNow(v);
                  }}
                  kind="amount"
                />
                {liveHint ? <AppText style={styles.hint}>{liveHint}</AppText> : null}
                <Field
                  label={dict.wealth.fields.venue}
                  value={cryptoVenue}
                  onChange={setCryptoVenue}
                />
              </>
            ) : null}

            {assetClass === 'stock' ? (
              <>
                <Field
                  label={dict.wealth.fields.symbol}
                  value={stockSymbol}
                  onChange={setStockSymbol}
                />
                <Field
                  label={dict.wealth.fields.company}
                  value={stockCompany}
                  onChange={setStockCompany}
                />
                <Field
                  label={dict.wealth.fields.quantity}
                  value={stockQty}
                  onChange={v => setStockQty(decimalInput(v))}
                  kind="decimal"
                />
                <Field
                  label={dict.wealth.fields.avgBuy}
                  value={stockBuy}
                  onChange={setStockBuy}
                  kind="amount"
                />
                <Field
                  label={dict.wealth.fields.currentPrice}
                  value={stockNow}
                  onChange={setStockNow}
                  kind="amount"
                />
              </>
            ) : null}

            {assetClass === 'fund' ? (
              <>
                <Field
                  label={dict.wealth.fields.fundName}
                  value={fundName}
                  onChange={setFundName}
                />
                <Field
                  label={dict.wealth.fields.units}
                  value={fundUnits}
                  onChange={v => setFundUnits(decimalInput(v))}
                  kind="decimal"
                />
                <Field
                  label={dict.wealth.fields.purchaseNav}
                  value={fundBuyNav}
                  onChange={setFundBuyNav}
                  kind="amount"
                />
                <Field
                  label={dict.wealth.fields.currentNav}
                  value={fundNav}
                  onChange={setFundNav}
                  kind="amount"
                />
              </>
            ) : null}

            {assetClass === 'real_estate' ? (
              <>
                <Field label={dict.wealth.fields.city} value={reCity} onChange={setReCity} />
                <Field
                  label={dict.wealth.fields.area}
                  value={reArea}
                  onChange={v => setReArea(decimalInput(v))}
                  kind="decimal"
                />
                <Field
                  label={dict.wealth.fields.ownershipPct}
                  value={reOwn ? toPersianDigits(reOwn) : ''}
                  onChange={v => setReOwn(digitsOnly(v))}
                  keyboardType="number-pad"
                />
                <Field
                  label={dict.wealth.fields.purchasePrice}
                  value={rePurchase}
                  onChange={setRePurchase}
                  kind="amount"
                />
                <Field
                  label={dict.wealth.fields.estimatedValue}
                  value={reValue}
                  onChange={setReValue}
                  kind="amount"
                />
                <Field
                  label={dict.wealth.fields.mortgage}
                  value={reMortgage}
                  onChange={setReMortgage}
                  kind="amount"
                />
              </>
            ) : null}

            {assetClass === 'vehicle' ? (
              <>
                <Field label={dict.wealth.fields.brand} value={vBrand} onChange={setVBrand} />
                <Field label={dict.wealth.fields.model} value={vModel} onChange={setVModel} />
                <Field
                  label={dict.wealth.fields.year}
                  value={vYear ? toPersianDigits(vYear) : ''}
                  onChange={v => setVYear(digitsOnly(v))}
                  keyboardType="number-pad"
                />
                <Field
                  label={dict.wealth.fields.purchasePrice}
                  value={vPurchase}
                  onChange={setVPurchase}
                  kind="amount"
                />
                <Field
                  label={dict.wealth.fields.estimatedValue}
                  value={vValue}
                  onChange={setVValue}
                  kind="amount"
                />
              </>
            ) : null}

            {assetClass === 'business' ? (
              <>
                <Field
                  label={dict.wealth.fields.ownershipPct}
                  value={bizOwn ? toPersianDigits(bizOwn) : ''}
                  onChange={v => setBizOwn(digitsOnly(v))}
                  keyboardType="number-pad"
                />
                <Field
                  label={dict.wealth.fields.businessValue}
                  value={bizVal}
                  onChange={setBizVal}
                  kind="amount"
                />
                <Field
                  label={dict.wealth.fields.investment}
                  value={bizInvest}
                  onChange={setBizInvest}
                  kind="amount"
                />
              </>
            ) : null}

            {['jewelry', 'collectible', 'other'].includes(assetClass) ? (
              <>
                <Field
                  label={dict.wealth.fields.purchasePrice}
                  value={purchaseValue}
                  onChange={setPurchaseValue}
                  kind="amount"
                />
                <Field
                  label={dict.wealth.fields.estimatedValue}
                  value={currentValue}
                  onChange={setCurrentValue}
                  kind="amount"
                />
              </>
            ) : null}

            <Field label={dict.wealth.fields.notes} value={notes} onChange={setNotes} />
            <AppText style={styles.hint}>{dict.wealth.manualPriceHint}</AppText>
            {formError ? <AppText style={styles.formError}>{formError}</AppText> : null}
            <PrimaryButton label={dict.common.save} onPress={() => void save()} />
          </View>
        )}
      </ScrollView>
    </NightCanvas>
  );
}
