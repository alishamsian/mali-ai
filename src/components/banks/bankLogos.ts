import type { ImageSourcePropType } from 'react-native';

/**
 * لوگوها از IranianBankLogos (پس‌زمینه سفید حذف شده — شفاف):
 * https://github.com/amastaneh/IranianBankLogos
 * بانک‌های بدون فایل اینجا → BankEmblem از GenericEmblem استفاده می‌کند.
 */
export const BANK_LOGO_SOURCES: Record<string, ImageSourcePropType> = {
  ansar: require('../../../assets/banks/ansar.png'),
  dey: require('../../../assets/banks/dey.png'),
  eghtesad_novin: require('../../../assets/banks/eghtesad_novin.png'),
  gardeshgari: require('../../../assets/banks/gardeshgari.png'),
  ghavamin: require('../../../assets/banks/ghavamin.png'),
  hekmat: require('../../../assets/banks/hekmat.png'),
  iran_venezuela: require('../../../assets/banks/iran_venezuela.png'),
  iran_zamin: require('../../../assets/banks/iran_zamin.png'),
  karafarin: require('../../../assets/banks/karafarin.png'),
  keshavarzi: require('../../../assets/banks/keshavarzi.png'),
  maskan: require('../../../assets/banks/maskan.png'),
  mehr_eghtesad: require('../../../assets/banks/mehr_eghtesad.png'),
  mehr_iran: require('../../../assets/banks/mehr_iran.png'),
  mellat: require('../../../assets/banks/mellat.png'),
  melli: require('../../../assets/banks/melli.png'),
  parsian: require('../../../assets/banks/parsian.png'),
  pasargad: require('../../../assets/banks/pasargad.png'),
  postbank: require('../../../assets/banks/postbank.png'),
  refah: require('../../../assets/banks/refah.png'),
  resalat: require('../../../assets/banks/resalat.png'),
  saderat: require('../../../assets/banks/saderat.png'),
  saman: require('../../../assets/banks/saman.png'),
  sanat_madan: require('../../../assets/banks/sanat_madan.png'),
  sepah: require('../../../assets/banks/sepah.png'),
  shahr: require('../../../assets/banks/shahr.png'),
  sina: require('../../../assets/banks/sina.png'),
  tejarat: require('../../../assets/banks/tejarat.png'),
  tosee_taavon: require('../../../assets/banks/tosee_taavon.png'),
};

export function resolveBankLogo(bankId?: string): ImageSourcePropType | undefined {
  if (!bankId) {
    return undefined;
  }
  return BANK_LOGO_SOURCES[bankId];
}
