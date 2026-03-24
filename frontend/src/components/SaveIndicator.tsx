import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../utils/theme';
import { SaveStatus } from '../context/ProjectContext';

interface SaveIndicatorProps {
  status: SaveStatus;
  lastSaved: Date | null;
}

export function SaveIndicator({ status, lastSaved }: SaveIndicatorProps) {
  const [opacity] = useState(new Animated.Value(0));
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status !== 'idle') {
      setVisible(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setVisible(false));
    }
  }, [status, opacity]);

  if (!visible && status === 'idle') return null;

  const getStatusConfig = () => {
    switch (status) {
      case 'saving':
        return {
          icon: 'sync' as const,
          text: 'Saving...',
          color: colors.primary,
          bgColor: colors.tintPrimary,
        };
      case 'saved':
        return {
          icon: 'checkmark-circle' as const,
          text: 'Saved',
          color: colors.success,
          bgColor: colors.tintSuccess,
        };
      case 'error':
        return {
          icon: 'alert-circle' as const,
          text: 'Save failed',
          color: colors.error,
          bgColor: colors.tintError,
        };
      default:
        return {
          icon: 'ellipse' as const,
          text: '',
          color: colors.gray400,
          bgColor: colors.gray100,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Animated.View style={[styles.container, { opacity, backgroundColor: config.bgColor }]}>
      <Ionicons 
        name={config.icon} 
        size={14} 
        color={config.color}
        style={status === 'saving' ? styles.spinning : undefined}
      />
      <Text style={[styles.text, { color: config.color }]}>{config.text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
  },
  spinning: {
    // Note: React Native doesn't support CSS animations
    // For web, we could add a rotation animation
  },
});
