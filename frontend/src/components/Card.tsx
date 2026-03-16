import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, borderRadius, shadows, spacing } from '../utils/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'elevated' | 'outlined' | 'glass';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({
  children,
  style,
  variant = 'default',
  padding = 'md',
}: CardProps) {
  const getPaddingStyle = (): ViewStyle => {
    switch (padding) {
      case 'none':
        return { padding: 0 };
      case 'sm':
        return { padding: spacing.sm };
      case 'lg':
        return { padding: spacing.lg };
      default:
        return { padding: spacing.md };
    }
  };

  const getVariantStyles = (): ViewStyle[] => {
    const baseStyles: ViewStyle[] = [styles.card, getPaddingStyle()];

    switch (variant) {
      case 'elevated':
        baseStyles.push(styles.elevated);
        break;
      case 'outlined':
        baseStyles.push(styles.outlined);
        break;
      case 'glass':
        baseStyles.push(styles.glass);
        break;
      default:
        baseStyles.push(styles.default);
        break;
    }

    return baseStyles;
  };

  return (
    <View style={[...getVariantStyles(), style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.md,
  },
  default: {
    backgroundColor: colors.cardBg,
    ...shadows.md,
  },
  elevated: {
    backgroundColor: colors.cardBg,
    ...shadows.lg,
  },
  outlined: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  glass: {
    backgroundColor: colors.glassBg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    ...shadows.sm,
  },
});
