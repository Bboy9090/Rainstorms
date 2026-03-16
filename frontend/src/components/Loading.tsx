import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { colors, spacing } from '../utils/theme';
import { springConfigs } from '../utils/animations';

interface LoadingProps {
  message?: string;
  fullScreen?: boolean;
}

export function Loading({ message = 'Loading...', fullScreen = false }: LoadingProps) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withSpring(1.05, springConfigs.gentle),
        withSpring(1, springConfigs.gentle)
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={[styles.container, fullScreen && styles.fullScreen]}>
      <Animated.View style={[styles.content, animatedStyle]}>
        <ActivityIndicator size="large" color={colors.primary} />
        {message && <Text style={styles.message}>{message}</Text>}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  fullScreen: {
    flex: 1,
    backgroundColor: colors.bgStart,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    marginTop: spacing.md,
    fontSize: 16,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
