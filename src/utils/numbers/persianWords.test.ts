import { numberToPersianWords, tomanToPersianWords } from './persianWords';

describe('persianWords', () => {
  it('converts common amounts', () => {
    expect(numberToPersianWords(0)).toBe('صفر');
    expect(numberToPersianWords(12)).toBe('دوازده');
    expect(numberToPersianWords(21)).toBe('بیست و یک');
    expect(numberToPersianWords(105)).toBe('یکصد و پنج');
    expect(numberToPersianWords(1000)).toBe('یک هزار');
    expect(numberToPersianWords(2500)).toBe('دو هزار و پانصد');
    expect(numberToPersianWords(1_234_567)).toBe(
      'یک میلیون و دویست و سی و چهار هزار و پانصد و شصت و هفت',
    );
  });

  it('appends toman unit', () => {
    expect(tomanToPersianWords(1500)).toBe('یک هزار و پانصد تومان');
    expect(tomanToPersianWords(0)).toBeNull();
  });
});
