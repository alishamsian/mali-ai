import { assertAllowedMarketUrl } from './secureFetch';

describe('secureMarketFetch', () => {
  it('allows known market hosts over https', () => {
    expect(() => assertAllowedMarketUrl('https://call1.tgju.org/ajax.json')).not.toThrow();
    expect(() => assertAllowedMarketUrl('https://api.coingecko.com/api/v3/simple/price')).not.toThrow();
  });

  it('blocks unknown hosts', () => {
    expect(() => assertAllowedMarketUrl('https://evil.example/data.json')).toThrow('host_not_allowed');
    expect(() => assertAllowedMarketUrl('http://call1.tgju.org/ajax.json')).toThrow('https_required');
  });
});
