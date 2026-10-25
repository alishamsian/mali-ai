import {
  applyUserTheme,
  getThemeSnapshot,
  getResolvedMode,
  getCurrentAccent,
} from './runtime';

describe('theme runtime', () => {
  it('keeps getThemeSnapshot reference stable when unchanged', () => {
    applyUserTheme({ theme: 'dark', accentId: 'emerald' });
    const a = getThemeSnapshot();
    const b = getThemeSnapshot();
    expect(a).toBe(b);
    expect(getResolvedMode()).toBe('dark');
    expect(getCurrentAccent().id).toBe('emerald');
  });

  it('updates snapshot reference only when theme actually changes', () => {
    applyUserTheme({ theme: 'dark', accentId: 'emerald' });
    const before = getThemeSnapshot();
    applyUserTheme({ theme: 'dark', accentId: 'emerald' });
    expect(getThemeSnapshot()).toBe(before);

    applyUserTheme({ theme: 'light', accentId: 'ocean' });
    const after = getThemeSnapshot();
    expect(after).not.toBe(before);
    expect(after.mode).toBe('light');
    expect(after.accent.id).toBe('ocean');
    expect(after.colors.background).toBeTruthy();
  });

  it('can switch accents without crashing', () => {
    applyUserTheme({ theme: 'dark', accentId: 'violet' });
    applyUserTheme({ theme: 'dark', accentId: 'gold' });
    applyUserTheme({ theme: 'dark', accentId: 'rose' });
    applyUserTheme({ theme: 'dark', accentId: 'graphite' });
    expect(getCurrentAccent().id).toBe('graphite');
  });
});
