/** The approved daylight materials; dark mode keeps the same readable composition. */
export function homePalette(mode: 'light' | 'dark') {
  return mode === 'light'
    ? {
        divider: 'rgba(47,69,88,0.10)',
        quiet: 'rgba(255,255,255,0.58)',
        bank: ['#D7EAF6', '#ECF5FC'],
        gold: ['#F7E9C9', '#FFFAEE'],
        neutral: ['#EAF0F3', '#F8FAFB'],
        engraving: 'rgba(80,146,193,0.10)',
        goldInk: '#84611F',
        bar: '#CCD8E1',
        track: '#DCE5EB',
        positive: '#E0F3E8',
      }
    : {
        divider: 'rgba(223,235,244,0.10)',
        quiet: 'rgba(255,255,255,0.045)',
        bank: ['#152E41', '#10232F'],
        gold: ['#3D321F', '#28241B'],
        neutral: ['#1D2A31', '#142026'],
        engraving: 'rgba(136,190,221,0.12)',
        goldInk: '#E5C17A',
        bar: '#40535F',
        track: '#293C47',
        positive: '#173B2D',
      };
}
