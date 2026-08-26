/**
 * Design tokens extracted from Figma file vbXmJRwTbi8qoPSt2U5Ojh:
 * Login with Phone Number, splash screen, Sign Up - Business Details.
 */

export const colors = {
  white: '#FFFFFF',
  background: '#F3FAFF',
  surface: '#FFFFFF',

  primary: '#000666',
  heading: '#071E27',
  hero: '#1A237E',
  heroText: '#8690EE',
  accent: '#006B5F',
  success: '#007165',
  error: '#BA1A1A',

  textSecondary: '#454652',
  textMuted: '#767683',
  textPlaceholder: '#C6C5D4',

  border: '#C6C5D4',
  borderStrong: '#767683',
  stepperTrack: '#CFE6F2',
  tintSoft: '#D5ECF8',
  mapFill: '#E6F6FF',
  accentSoft: '#8DF5E4',

  overlayPrimary: 'rgba(0, 6, 102, 0.05)',
  overlayAccent: 'rgba(0, 107, 95, 0.05)',
  overlayHeroText: 'rgba(134, 144, 238, 0.8)',
  overlayTrust: 'rgba(141, 245, 228, 0.3)',
  overlayHeader: 'rgba(243, 250, 255, 0.8)',
  overlayMapLabel: 'rgba(243, 250, 255, 0.9)',
  overlayStatus: 'rgba(69, 70, 82, 0.6)',
  overlayWhite10: 'rgba(255, 255, 255, 0.1)',
} as const;

export const typography = {
  fontFamily: 'Inter',
  weights: { regular: '400', medium: '500', semibold: '600', bold: '700' },
  sizes: {
    caption: 10,
    label: 12,
    body: 14,
    input: 16,
    headingSm: 20,
    heading: 24,
    display: 32,
  },
  lineHeights: {
    caption: 15,
    label: 16,
    body: 20,
    input: 24,
    headingSm: 28,
    heading: 32,
    display: 40,
  },
  letterSpacing: {
    display: -0.8,
    heading: -0.24,
    none: 0,
    button: 0.14,
    label: 0.6,
    overline: 1.2,
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  input: 56,
  screen: 16,
  card: 24,
  section: 32,
} as const;
