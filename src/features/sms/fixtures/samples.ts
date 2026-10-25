/** نمونه‌های واقعی برای تست دستی روی امولاتور / صفحه SmsTest */
export type SmsSample = {
  id: string;
  label: string;
  bankId: string;
  sender: string;
  body: string;
};

export const SMS_SAMPLES: SmsSample[] = [
  {
    id: 'melli-transfer',
    label: 'ملی · واریز',
    bankId: 'melli',
    sender: '9830009417',
    body: 'بانك ملي ايران\nانتقال:1,500,000+\nحساب:61008\nمانده:117,896,079\n0603-19:36',
  },
  {
    id: 'melli-pol',
    label: 'ملی · پل',
    bankId: 'melli',
    sender: '9830009417',
    body: '...حواله پل:2,500,000+\nحساب:61008\nمانده:105,596,079\n\n0603-11:28',
  },
  {
    id: 'melli-purchase',
    label: 'ملی · خرید',
    bankId: 'melli',
    sender: '9830009417',
    body: '...خريداينترنتي:10,890,000-\nحساب:61008\nمانده:118,991,479\n0603-10:15',
  },
  {
    id: 'mellat-deposit',
    label: 'ملت · واریز',
    bankId: 'mellat',
    sender: '9909',
    body: 'بانک ملت\nواریز مبلغ 5,000,000 ریال\nمانده 120,000,000 ریال\nکارت ****1234',
  },
  {
    id: 'mellat-purchase',
    label: 'ملت · خرید',
    bankId: 'mellat',
    sender: '9909',
    body: 'بانک ملت\nخرید از دیجی کالا\nمبلغ 2,500,000 ریال کسر شد\nمانده 98,000,000\nکارت ****5678',
  },
];
