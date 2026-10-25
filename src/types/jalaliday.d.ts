import 'dayjs';

declare module 'dayjs' {
  interface Dayjs {
    calendar(name: 'jalali' | string): Dayjs;
  }
}

declare module 'jalaliday';
