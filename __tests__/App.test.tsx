/**
 * @format
 */
describe('bootstrap', () => {
  it('project name is mali-ai', () => {
    expect(require('../package.json').name).toBe('mali-ai');
  });
});
