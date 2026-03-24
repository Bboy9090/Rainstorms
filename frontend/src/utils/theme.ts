/**
 * Rainstorms — dark “storm” theme aligned with the emblem logo:
 * cyan primary, deep navy surfaces, gold accents.
 */
export const colors = {
  primary: 'hsl(192, 85%, 55%)', // ~#38B8E8 — logo cyan
  primaryLight: 'hsl(192, 90%, 68%)',
  primaryDark: 'hsl(198, 78%, 42%)',

  secondary: 'hsl(330, 75%, 68%)',
  secondaryLight: 'hsl(330, 86%, 81%)',

  accent: 'hsl(45, 93%, 58%)',
  accentLight: 'hsl(45, 96%, 65%)',

  /** Page / screen backgrounds */
  bgStart: 'hsl(222, 47%, 8%)',
  bgEnd: 'hsl(218, 32%, 14%)',
  /** Mid tone for subtle gradients */
  bgMid: 'hsl(215, 28%, 11%)',

  /** Glass panels */
  glassBg: 'rgba(255, 255, 255, 0.06)',
  glassBorder: 'rgba(255, 255, 255, 0.12)',
  glassText: '#F1F5F9',

  textPrimary: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',

  cardBg: '#1E293B',
  cardBorder: '#334155',

  /** Inputs & elevated surfaces */
  inputBg: '#1A2332',
  inputBorder: '#334155',

  /** Chip / selection tints (replaces light #EEF2FF-style fills) */
  tintPrimary: 'rgba(56, 189, 248, 0.16)',
  tintSecondary: 'rgba(244, 114, 182, 0.14)',
  tintAccent: 'rgba(251, 191, 36, 0.14)',
  tintSuccess: 'rgba(16, 185, 129, 0.14)',
  tintError: 'rgba(239, 68, 68, 0.18)',

  success: 'hsl(161, 72%, 45%)',
  error: 'hsl(0, 84%, 62%)',
  warning: 'hsl(38, 92%, 55%)',
  info: 'hsl(192, 85%, 55%)',

  white: '#FFFFFF',
  black: '#000000',
  textLight: '#FFFFFF',

  gray100: '#1E293B',
  gray200: '#334155',
  gray300: '#475569',
  gray400: '#64748B',
  gray500: '#94A3B8',

  shadowColor: '#000000',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  full: 9999,
};

export const shadows = {
  sm: {
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  md: {
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 6,
  },
  lg: {
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  inner: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 1,
  },
};
