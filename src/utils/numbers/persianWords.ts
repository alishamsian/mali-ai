const ONES = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
const TEENS = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
const TENS = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
const HUNDREDS = [
  '',
  'یکصد',
  'دویست',
  'سیصد',
  'چهارصد',
  'پانصد',
  'ششصد',
  'هفتصد',
  'هشتصد',
  'نهصد',
];

function underThousandToWords(n: number): string {
  if (n <= 0 || n >= 1000) {
    return '';
  }
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds > 0) {
    parts.push(HUNDREDS[hundreds]);
  }
  if (rest >= 10 && rest < 20) {
    parts.push(TEENS[rest - 10]);
  } else {
    const tens = Math.floor(rest / 10);
    const ones = rest % 10;
    if (tens > 0) {
      parts.push(TENS[tens]);
    }
    if (ones > 0) {
      parts.push(ONES[ones]);
    }
  }
  return parts.join(' و ');
}

/** عدد صحیح غیرمنفی را به حروف فارسی تبدیل می‌کند. */
export function numberToPersianWords(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    return '';
  }
  const n = Math.trunc(value);
  if (n === 0) {
    return 'صفر';
  }

  const scales: Array<{ value: number; label: string }> = [
    { value: 1_000_000_000_000, label: 'تریلیون' },
    { value: 1_000_000_000, label: 'میلیارد' },
    { value: 1_000_000, label: 'میلیون' },
    { value: 1_000, label: 'هزار' },
  ];

  let remaining = n;
  const parts: string[] = [];
  for (const scale of scales) {
    if (remaining >= scale.value) {
      const count = Math.floor(remaining / scale.value);
      remaining %= scale.value;
      const chunk = underThousandToWords(count);
      if (chunk) {
        parts.push(`${chunk} ${scale.label}`);
      }
    }
  }
  if (remaining > 0) {
    parts.push(underThousandToWords(remaining));
  }
  return parts.join(' و ');
}

export function tomanToPersianWords(toman: number | null | undefined): string | null {
  if (toman == null || toman <= 0) {
    return null;
  }
  return `${numberToPersianWords(toman)} تومان`;
}
