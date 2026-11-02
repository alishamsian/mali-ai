/**
 * Real Bank Melli SMS fixtures (sender 9830009417), 2026-08:
 *
 * بانك ملي ايران
 * انتقال:1,500,000+
 * حساب:61008
 * مانده:117,896,079
 * 0603-19:36
 *
 * ...حواله پل:2,500,000+
 * حساب:61008
 * مانده:105,596,079
 * 0603-11:28
 *
 * ...خريداينترنتي:10,890,000-
 * حساب:61008
 * مانده:118,991,479
 * 0603-10:15
 */
export const MELLI_SENDERS = ['9830009417', '983000'];

export const MELLI_SIGNED_AMOUNT = /([^:\s]{2,40}):(\d{4,})([+-])/;
export const MELLI_ACCOUNT = /حساب[:\s]*(\d{4,})/;
export const MELLI_BALANCE = /مانده[:\s]*(-?\d{3,})/;
export const MELLI_JALALI_TIME = /(\d{2})(\d{2})-(\d{1,2}):(\d{2})/;
