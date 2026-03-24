import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../src/utils/theme';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { useAuth } from '../src/context/AuthContext';
import { useProject } from '../src/context/ProjectContext';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { loadDemoProject, isLoading } = useProject();

  const handleDemoProject = async () => {
    await loadDemoProject();
    router.push('/blueprint');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <LinearGradient
        colors={['#0B1220', '#111A2E', '#1A1428']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../assets/images/rainstorms-logo.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.logo}>Rainstorms</Text>
        </View>
        {user ? (
          <TouchableOpacity onPress={logout} style={styles.authButton}>
            <Ionicons name="log-out-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.authButtonText}>Logout</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => router.push('/auth')}
            style={styles.authButton}
          >
            <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.authButtonText}>Sign In</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Hero Section */}
      <View style={styles.hero}>
        <View style={styles.heroLogo}>
          <Image
            source={require('../assets/images/rainstorms-logo.png')}
            style={styles.heroLogoImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.heroTitle}>Where Stories Pour Down</Text>
        <Text style={styles.heroSubtitle}>
          Create beautiful children's picture books with AI-powered story generation.
          From a simple idea to a complete draft in one session.
        </Text>
      </View>

      {/* Main Actions */}
      <View style={styles.actions}>
        <Button
          title="New Story"
          onPress={() => router.push('/idea-lab')}
          size="lg"
          icon={<Ionicons name="sparkles" size={24} color={colors.white} />}
          style={styles.primaryButton}
        />

        <Button
          title="Lore Pool"
          onPress={() => router.push('/lore-pool')}
          size="lg"
          icon={<Ionicons name="library" size={24} color={colors.white} />}
          style={[styles.primaryButton, { backgroundColor: colors.secondary }]}
        />

        {user && (
          <Button
            title="My Projects"
            onPress={() => router.push('/projects')}
            variant="outline"
            size="lg"
            icon={<Ionicons name="folder-outline" size={24} color={colors.primary} />}
            style={styles.secondaryButton}
          />
        )}

        <Button
          title="Try Demo Project"
          onPress={handleDemoProject}
          variant="ghost"
          size="md"
          loading={isLoading}
          icon={<Ionicons name="play-circle-outline" size={22} color={colors.primary} />}
        />
      </View>

      {/* Demo Preview Card */}
      <Card style={styles.demoCard} variant="elevated">
        <View style={styles.demoHeader}>
          <Ionicons name="star" size={20} color={colors.accent} />
          <Text style={styles.demoLabel}>Featured Demo</Text>
        </View>
        <Text style={styles.demoTitle}>Captain Blanket and the Midnight Brother</Text>
        <Text style={styles.demoDescription}>
          A child with a magical blanket cape protects his baby brother from night
          monsters at bedtime and learns what it means to be a big brother hero.
        </Text>
        <View style={styles.demoMeta}>
          <View style={styles.demoTag}>
            <Text style={styles.demoTagText}>Ages 3-8</Text>
          </View>
          <View style={styles.demoTag}>
            <Text style={styles.demoTagText}>10 Pages</Text>
          </View>
          <View style={styles.demoTag}>
            <Text style={styles.demoTagText}>Cozy</Text>
          </View>
        </View>
      </Card>

      {/* Features */}
      <View style={styles.features}>
        <Text style={styles.featuresTitle}>How it works</Text>
        <View style={styles.featureGrid}>
          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: colors.tintPrimary }]}>
              <Ionicons name="bulb-outline" size={28} color={colors.primary} />
            </View>
            <Text style={styles.featureLabel}>Start with an idea</Text>
            <Text style={styles.featureText}>Enter your story concept and preferences</Text>
          </View>
          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: colors.tintSecondary }]}>
              <Ionicons name="document-text-outline" size={28} color={colors.secondary} />
            </View>
            <Text style={styles.featureLabel}>Generate Blueprint</Text>
            <Text style={styles.featureText}>AI creates title, outline & characters</Text>
          </View>
          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: colors.tintAccent }]}>
              <Ionicons name="create-outline" size={28} color={colors.accent} />
            </View>
            <Text style={styles.featureLabel}>Build Pages</Text>
            <Text style={styles.featureText}>Generate text & illustration prompts</Text>
          </View>
          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: colors.tintSuccess }]}>
              <Ionicons name="download-outline" size={28} color={colors.success} />
            </View>
            <Text style={styles.featureLabel}>Export</Text>
            <Text style={styles.featureText}>Download your complete book draft</Text>
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Designed for children's book creators
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgStart,
  },
  content: {
    minHeight: '100%',
    paddingBottom: spacing.xxl,
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadows.md,
  },
  headerLogo: {
    width: 40,
    height: 40,
  },
  logo: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginLeft: spacing.sm,
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.cardBg,
    borderRadius: borderRadius.full,
    ...shadows.sm,
  },
  authButtonText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  heroLogo: {
    width: 180,
    height: 180,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: '#000',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
  heroLogoImage: {
    width: 160,
    height: 160,
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 44,
    maxWidth: 500,
  },
  heroSubtitle: {
    fontSize: 18,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 28,
    maxWidth: 450,
  },
  actions: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  primaryButton: {
    width: '100%',
    maxWidth: 320,
  },
  secondaryButton: {
    width: '100%',
    maxWidth: 320,
  },
  demoCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  demoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  demoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
    marginLeft: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  demoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  demoDescription: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  demoMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  demoTag: {
    backgroundColor: colors.gray200,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
  },
  demoTagText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  features: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  },
  featuresTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
  },
  featureItem: {
    width: width > 600 ? '45%' : '100%',
    maxWidth: 280,
    backgroundColor: colors.cardBg,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadows.sm,
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  featureLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  featureText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
  },
  footerText: {
    fontSize: 14,
    color: colors.textMuted,
  },
});
