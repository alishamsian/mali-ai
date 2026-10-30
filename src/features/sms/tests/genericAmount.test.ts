import { extractAmountParts } from '../banks/generic/parser';

const amountOf = (body: string) => extractAmountParts(body)?.amount;

describe('generic amount scoring', () => {
  it.each([
    ['برداشت 1,250,000\nحساب 0123456789\nمانده 9,400,000\n1405/08/05 12:10', 1_250_000],
    ['مانده:3,000,000\nمبلغ:420,000 ریال\nکارت 6037****4321', 420_000],
    ['حساب 61008\n+2,750,000\n1405/08/05\nمانده 8,000,000', 2_750_000],
    ['حساب 61008\n95,000-\n0805-09:30\nمانده 7,905,000', 95_000],
    ['شماره پیگیری 884512\nواریز به حساب شما مبلغ 600,000', 600_000],
  ])('%s', (body, amount) => {
    expect(amountOf(body)).toBe(amount);
  });

  it('finds nothing in a one-time-password message', () => {
    expect(amountOf('رمز پویا 583921\nاعتبار 2 دقیقه')).toBeUndefined();
  });
});
