/**
 * Rainstorms — Magical Dreamy Storybook Theme
 * Matches the rich new logo with rainbows, deep space blues, and glowing accents.
 */
export const colors = {
  // Primary - Cyan/Blue from the logo
  primary: 'hsl(195, 90%, 65%)', 
  primaryLight: 'hsl(195, 95%, 75%)',
  primaryDark: 'hsl(200, 80%, 45%)',

  // Secondary - Pink/Purple
  secondary: 'hsl(315, 80%, 70%)',
  secondaryLight: 'hsl(315, 90%, 80%)',

  // Accent - Gold/Yellow from the book glow
  accent: 'hsl(45, 100%, 65%)',
  accentLight: 'hsl(45, 100%, 75%)',

  // Rainbow Palette for various accents
  rainbow: [
    '#FF6B6B', // Red-ish
    '#FFD93D', // Yellow-ish
    '#6BCB77', // Green-ish
    '#4D96FF', // Blue-ish
    '#9B59B6', // Purple-ish
  ],

  /** Page / screen backgrounds - Deep Dreamy Space */
  bgStart: '#05070A',
  bgMid: '#101525',
  bgEnd: '#1A1B2E',

  /** Glass panels - Premium feeling */
  glassBg: 'rgba(255, 255, 255, 0.08)',
  glassBorder: 'rgba(255, 255, 255, 0.15)',
  glassText: '#F8FAFC',
  glassReflection: 'rgba(255, 255, 255, 0.05)',

  textPrimary: '#FFFFFF',
  textSecondary: '#E2E8F0',
  textMuted: '#94A3B8',

  cardBg: 'rgba(20, 24, 40, 0.85)',
  cardBorder: 'rgba(51, 65, 85, 0.5)',

  /** Inputs & elevated surfaces */
  inputBg: '#0F172A',
  inputBorder: '#334155',

  /** Chip / selection tints */
  tintPrimary: 'rgba(56, 189, 248, 0.2)',
  tintSecondary: 'rgba(232, 121, 249, 0.15)',
  tintAccent: 'rgba(251, 191, 36, 0.15)',
  tintSuccess: 'rgba(52, 211, 153, 0.15)',
  tintError: 'rgba(248, 113, 113, 0.2)',

  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',

  white: '#FFFFFF',
  black: '#000000',
  textLight: '#FFFFFF',

  gray100: '#1E293B',
  gray200: '#334155',
  gray300: '#475569',
  gray400: '#64748B',
  gray500: '#94A3B8',

  shadowColor: '#000000',
  glowPrimary: 'rgba(56, 189, 248, 0.35)',
  glowSecondary: 'rgba(232, 121, 249, 0.3)',
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
  sm: 10,
  md: 20,
  lg: 30,
  xl: 40,
  full: 9999,
};

export const shadows = {
  sm: {
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  lg: {
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 35,
    elevation: 15,
  },
  primaryGlow: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 10,
  },
};

