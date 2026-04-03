import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { colors, spacing, borderRadius, shadows } from '../src/utils/theme';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { useAuth } from '../src/context/AuthContext';
import { useProject } from '../src/context/ProjectContext';

// const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { loadDemoProject } = useProject();

  // Floating animation for the logo
  const translateY = useSharedValue(0);
  const glowOpacity = useSharedValue(0.4);

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(-15, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 2000 }),
        withTiming(0.4, { duration: 2000 })
      ),
      -1,
      true
    );
  }, [glowOpacity, translateY]);

  const animatedLogoStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const animatedGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const handleDemoProject = async () => {
    await loadDemoProject();
    router.push('/blueprint');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[colors.bgStart, colors.bgMid, colors.bgEnd]}
        style={StyleSheet.absoluteFill}
      />

      {/* Decorative Rainbow Blur */}
      <View style={styles.rainbowBlur} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.logoText}>Rainstorms</Text>
          </View>
          {user ? (
            <TouchableOpacity onPress={logout} style={styles.glassButton}>
              <Ionicons name="log-out-outline" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => router.push('/auth')}
              style={styles.glassButton}
            >
              <Ionicons name="person-outline" size={20} color={colors.textPrimary} />
              <Text style={styles.authButtonText}>Sign In</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Hero Section */}
        <View style={styles.hero}>
          <Animated.View style={[styles.glowContainer, animatedGlowStyle]}>
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              style={styles.logoGlow}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          </Animated.View>
          
          <Animated.View style={[styles.heroLogo, animatedLogoStyle]}>
            <Image
              source={require('../assets/images/rainstorms-logo.png')}
              style={styles.heroLogoImage}
              resizeMode="contain"
            />
          </Animated.View>
          
          <Text style={styles.heroTitle}>Where Stories Pour Down</Text>
          <Text style={styles.heroSubtitle}>
            Unleash magical children&apos;s books with the power of AI. 
            From a spark of imagination to a finished masterpiece.
          </Text>
        </View>

        {/* Main Actions */}
        <View style={styles.actions}>
          <View style={styles.primaryActionRow}>
            <TouchableOpacity 
              style={[styles.actionCard, { flex: 1.2 }]} 
              onPress={() => router.push('/idea-lab')}
            >
              <LinearGradient
                colors={['rgba(56, 189, 248, 0.2)', 'rgba(56, 189, 248, 0.05)']}
                style={styles.actionCardGradient}
              />
              <View style={styles.actionIconContainer}>
                <Ionicons name="sparkles" size={32} color={colors.primary} />
              </View>
              <Text style={styles.actionLabel}>Start New Story</Text>
              <Text style={styles.actionDesc}>Begin your journey</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionCard, { flex: 1, backgroundColor: 'rgba(155, 89, 182, 0.1)' }]} 
              onPress={() => router.push('/lore-pool')}
            >
              <LinearGradient
                colors={['rgba(232, 121, 249, 0.2)', 'rgba(232, 121, 249, 0.05)']}
                style={styles.actionCardGradient}
              />
              <View style={styles.actionIconContainer}>
                <Ionicons name="library" size={32} color={colors.secondary} />
              </View>
              <Text style={styles.actionLabel}>Lore Pool</Text>
              <Text style={styles.actionDesc}>Manage your world</Text>
            </TouchableOpacity>
          </View>

          {user && (
            <Button
              title="My Projects"
              onPress={() => router.push('/projects')}
              variant="outline"
              size="lg"
              style={styles.fullWidthButton}
              icon={<Ionicons name="folder-open-outline" size={24} color={colors.primary} />}
            />
          )}

          <TouchableOpacity style={styles.demoTrigger} onPress={handleDemoProject}>
            <Ionicons name="play-circle" size={20} color={colors.accent} />
            <Text style={styles.demoTriggerText}>Explore a Live Story Demo</Text>
          </TouchableOpacity>
        </View>

        {/* Featured Card */}
        <Card style={styles.featuredCard} variant="glass">
          <View style={styles.rainbowStrip} />
          <View style={styles.featuredHeader}>
            <View style={styles.featuredBadge}>
              <Text style={styles.featuredBadgeText}>LATEST DRAFT</Text>
            </View>
            <Ionicons name="star" size={20} color={colors.accent} />
          </View>
          <Text style={styles.featuredTitle}>Captain Blanket and the Midnight Brother</Text>
          <Text style={styles.featuredDescription}>
            A cozy adventure about bravery and the magical bond between brothers.
          </Text>
          <View style={styles.featuredFooter}>
            <Text style={styles.featuredMeta}>12 Pages • Ages 4-8</Text>
            <TouchableOpacity style={styles.continueButton}>
              <Text style={styles.continueButtonText}>Continue</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.white} />
            </TouchableOpacity>
          </View>
        </Card>

        {/* How it Works Icons */}
        <View style={styles.steps}>
          <Text style={styles.sectionTitle}>The Magic Process</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stepsScroll}>
             {[
               { icon: 'bulb', label: 'Ideate', color: colors.primary },
               { icon: 'git-branch', label: 'Blueprint', color: colors.secondary },
               { icon: 'color-palette', label: 'Illustrate', color: colors.accent },
               { icon: 'book', label: 'Publish', color: colors.success },
             ].map((step, i) => (
               <View key={i} style={styles.stepItem}>
                 <View style={[styles.stepIcon, { backgroundColor: `${step.color}20` }]}>
                   <Ionicons name={`${step.icon}-outline` as any} size={28} color={step.color} />
                 </View>
                 <Text style={styles.stepLabel}>{step.label}</Text>
               </View>
             ))}
          </ScrollView>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Crafted for Little Dreamers</Text>
          <View style={styles.footerDots}>
            <View style={[styles.dot, { backgroundColor: colors.primary }]} />
            <View style={[styles.dot, { backgroundColor: colors.secondary }]} />
            <View style={[styles.dot, { backgroundColor: colors.accent }]} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgStart,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  rainbowBlur: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: colors.primary,
    opacity: 0.15,
    transform: [{ scale: 1.5 }],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: StatusBar.currentHeight ? StatusBar.currentHeight + spacing.md : spacing.xl,
    paddingBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  glassButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.glassBg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  authButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginLeft: spacing.xs,
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  glowContainer: {
    position: 'absolute',
    top: spacing.xl - 20,
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlow: {
    width: 180,
    height: 180,
    borderRadius: 90,
    opacity: 0.3,
    filter: 'blur(30px)', // Note: web only, for native we rely on opacity/radius
  },
  heroLogo: {
    width: 200,
    height: 200,
    marginBottom: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
  heroLogoImage: {
    width: 200,
    height: 200,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 38,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  heroSubtitle: {
    fontSize: 17,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 25,
    maxWidth: 320,
    opacity: 0.8,
  },
  actions: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  primaryActionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionCard: {
    height: 160,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    padding: spacing.md,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    justifyContent: 'flex-end',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  actionCardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  actionIconContainer: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    width: 50,
    height: 50,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  actionDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    opacity: 0.7,
    marginTop: 2,
  },
  fullWidthButton: {
    width: '100%',
    height: 64,
  },
  demoTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  demoTriggerText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  featuredCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  rainbowStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: colors.primary, // Could be actual rainbow gradient
  },
  featuredHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  featuredBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: colors.tintSecondary,
  },
  featuredBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.secondary,
    letterSpacing: 1,
  },
  featuredTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  featuredDescription: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    opacity: 0.8,
  },
  featuredFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  featuredMeta: {
    fontSize: 13,
    color: colors.textMuted,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  continueButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  steps: {
    marginTop: spacing.xl,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  stepsScroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  stepItem: {
    alignItems: 'center',
    width: 80,
  },
  stepIcon: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  stepLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  footerText: {
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  footerDots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.5,
  },
});

