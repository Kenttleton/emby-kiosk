// Emby dark theme — matches Emby's actual web client dark palette
export const Colors = {
  // Backgrounds
  bg:          '#121212',
  bgCard:      '#181818',
  bgElevated:  '#1E1E1E',
  bgOverlay:   '#252525',

  // Emby green accent
  accent:      '#52B54B',
  accentDark:  '#3E8437',
  accentDim:   '#162916',

  // Status
  green:     '#52B54B',
  yellow:    '#E5A00D',
  yellowDim: '#2A2000',
  red:       '#CC2929',
  redDim:    '#2A0808',

  // Text
  textPrimary:   '#FFFFFF',
  textSecondary: '#BBBBBB',
  textMuted:     '#888888',

  // Borders
  border:  '#2B2B2B',
  divider: '#3B3B3B',

  // Misc
  overlay:      'rgba(0,0,0,0.75)',
  glassDark:    'rgba(0,0,0,0.72)',
  accentGlow:   'rgba(82,181,75,0.20)',
  borderSubtle: 'rgba(255,255,255,0.06)',
};

export const Spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

export const Radius = {
  sm:  4,
  md:  8,
  lg:  12,
  xl:  24,
};

export const Typography = {
  displayLg: { fontSize: 28, fontWeight: '700' as const, color: Colors.textPrimary },
  displayMd: { fontSize: 22, fontWeight: '700' as const, color: Colors.textPrimary },
  title:     { fontSize: 18, fontWeight: '600' as const, color: Colors.textPrimary },
  body:      { fontSize: 15, fontWeight: '400' as const, color: Colors.textPrimary },
  caption:   { fontSize: 13, fontWeight: '400' as const, color: Colors.textSecondary },
  label:     { fontSize: 11, fontWeight: '600' as const, color: Colors.textMuted, letterSpacing: 1.0 },
};
