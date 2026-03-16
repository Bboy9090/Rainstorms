import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TextInputProps,
} from 'react-native';
import { colors, borderRadius, spacing, shadows } from '../utils/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  multiline?: boolean;
  numberOfLines?: number;
}

export function Input({
  label,
  error,
  containerStyle,
  inputStyle,
  multiline = false,
  numberOfLines = 1,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={[styles.label, isFocused && styles.labelFocused]}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          multiline && styles.multiline,
          multiline && { minHeight: numberOfLines * 24 + 24 },
          isFocused && styles.inputFocused,
          error && styles.inputError,
          inputStyle,
        ]}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        numberOfLines={numberOfLines}
        textAlignVertical={multiline ? 'top' : 'center'}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        {...props}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginLeft: 4,
  },
  labelFocused: {
    color: colors.primary,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontSize: 16,
    color: colors.textPrimary,
    ...shadows.inner,
  },
  inputFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.white,
    ...shadows.sm,
  },
  multiline: {
    paddingTop: spacing.sm + 4,
  },
  inputError: {
    borderColor: colors.error,
  },
  error: {
    fontSize: 12,
    color: colors.error,
    marginTop: spacing.xs,
    marginLeft: 4,
  },
});
