import { withSpring, WithSpringConfig } from 'react-native-reanimated';

/**
 * Legendary Spring Configs
 * Curated for a premium, snappy yet smooth feel.
 */
export const springConfigs = {
  // Snappy for buttons and interactions
  snappy: {
    damping: 15,
    stiffness: 150,
    mass: 1,
    overshootClamping: false,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 2,
  } as WithSpringConfig,
  
  // Gentle for list entries and page transitions
  gentle: {
    damping: 20,
    stiffness: 100,
    mass: 1,
    overshootClamping: false,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 2,
  } as WithSpringConfig,
  
  // Bouncy for playful elements
  bouncy: {
    damping: 10,
    stiffness: 120,
    mass: 1.2,
    overshootClamping: false,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 2,
  } as WithSpringConfig,
};

/**
 * Standard Scale Animation
 * Scales an element from its current scale to a target.
 */
export const animateScale = (targetScale: number, config: WithSpringConfig = springConfigs.snappy) => {
  'worklet';
  return withSpring(targetScale, config);
};
