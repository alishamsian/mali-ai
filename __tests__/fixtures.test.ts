import mellatDeposit from '../tests/fixtures/sms/mellat/deposit.json';

describe('real bank fixtures', () => {
  it('Mellat deposit fixture is marked until a real SMS is provided', () => {
    expect(mellatDeposit.status).toBe('NEEDS_FIXTURES');
  });
});
