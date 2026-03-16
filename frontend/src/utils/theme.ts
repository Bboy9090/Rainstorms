export const colors = {
  // Primary palette - Dreamy Indigo/Violet HSL
  primary: 'hsl(239, 84%, 67%)',      // #6366F1
  primaryLight: 'hsl(235, 89%, 74%)', // #818CF8
  primaryDark: 'hsl(243, 75%, 59%)',  // #4F46E5
  
  // Secondary palette - Vibrant Pink/Rose HSL
  secondary: 'hsl(330, 81%, 70%)',    // #F472B6
  secondaryLight: 'hsl(330, 86%, 81%)', // #F9A8D4
  
  // Accent - Warm Gold HSL
  accent: 'hsl(45, 93%, 58%)',        // #FBBF24
  accentLight: 'hsl(45, 96%, 65%)',   // #FCD34D
  
  // Legendary Gradients
  bgStart: 'hsl(210, 40%, 98%)',      // #F8FAFC
  bgEnd: 'hsl(226, 70%, 96%)',        // #EEF2FF
  
  // Glassmorphism System
  glassBg: 'rgba(255, 255, 255, 0.7)',
  glassBorder: 'rgba(255, 255, 255, 0.4)',
  glassText: '#1E293B',
  
  // Neutral - Slate HSL
  textPrimary: 'hsl(222, 47%, 11%)',  // #0F172A
  textSecondary: 'hsl(215, 25%, 30%)', // #334155
  textMuted: 'hsl(215, 16%, 47%)',    // #64748B
  textLight: '#FFFFFF',
  
  cardBg: '#FFFFFF',
  cardBorder: 'hsl(214, 32%, 91%)',   // #E2E8F0
  
  success: 'hsl(161, 84%, 39%)',      // #10B981
  error: 'hsl(0, 84%, 60%)',          // #EF4444
  warning: 'hsl(38, 92%, 50%)',       // #F59E0B
  info: 'hsl(221, 83%, 60%)',         // #3B82F6
  
  white: '#FFFFFF',
  black: '#000000',
  
  // Depth Shadows (Dreamy)
  shadowColor: 'hsl(239, 84%, 10%)',
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
  md: 16,             // Increased for softer feel
  lg: 24,
  xl: 32,
  full: 9999,
};

export const shadows = {
  sm: {
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  lg: {
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
  // New legendary shadow
  inner: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  }
};
