import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../src/utils/theme';
import { Card } from '../src/components/Card';
import { Loading } from '../src/components/Loading';
import { useProject } from '../src/context/ProjectContext';

const { width } = Dimensions.get('window');
const PREVIEW_WIDTH = Math.min(width - 48, 600);

export default function StorybookPreviewScreen() {
  const router = useRouter();
  const { currentProject, pages, characters, isLoading } = useProject();
  const [activePage, setActivePage] = useState(0);

  if (isLoading || !currentProject) {
    return <Loading message="Loading storybook..." fullScreen />;
  }

  const currentPageData = pages[activePage];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Ionicons name="albums" size={24} color={colors.primary} />
          <Text style={styles.title}>Storybook Preview</Text>
        </View>
        <TouchableOpacity
          style={styles.exportButton}
          onPress={() => router.push('/export')}
        >
          <Ionicons name="download-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Book Title */}
      <View style={styles.bookHeader}>
        <Text style={styles.bookTitle}>{currentProject.title}</Text>
        <Text style={styles.bookMeta}>Ages {currentProject.age_range} • {pages.length} pages</Text>
      </View>

      {/* Storybook Spread */}
      <View style={styles.spreadContainer}>
        <View style={styles.spread}>
          {/* Left Side - Illustration Placeholder */}
          <View style={styles.illustrationSide}>
            <View style={styles.illustrationPlaceholder}>
              <Ionicons name="image" size={48} color={colors.gray300} />
              <Text style={styles.illustrationLabel}>Illustration</Text>
              <Text style={styles.illustrationHint}>Page {currentPageData?.page_number}</Text>
            </View>
            {currentPageData?.illustration_prompt && (
              <View style={styles.promptPreview}>
                <Text style={styles.promptPreviewLabel}>Art Direction:</Text>
                <Text style={styles.promptPreviewText} numberOfLines={3}>
                  {currentPageData.illustration_prompt}
                </Text>
              </View>
            )}
          </View>

          {/* Right Side - Text */}
          <View style={styles.textSide}>
            <View style={styles.pageNumberBadge}>
              <Text style={styles.pageNumberText}>{currentPageData?.page_number}</Text>
            </View>
            {currentPageData?.page_text ? (
              <Text style={styles.pageText}>{currentPageData.page_text}</Text>
            ) : (
              <View style={styles.emptyTextContainer}>
                <Ionicons name="document-text-outline" size={32} color={colors.gray300} />
                <Text style={styles.emptyText}>No text yet</Text>
              </View>
            )}
            {currentPageData?.emotional_beat && (
              <View style={styles.emotionalBeatTag}>
                <Ionicons name="heart" size={12} color={colors.secondary} />
                <Text style={styles.emotionalBeatText}>{currentPageData.emotional_beat}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Page Navigation Dots */}
      <View style={styles.dotsContainer}>
        {pages.map((page, index) => (
          <TouchableOpacity
            key={page.id}
            style={[
              styles.dot,
              index === activePage && styles.dotActive,
              page.page_text && page.illustration_prompt && styles.dotComplete,
            ]}
            onPress={() => setActivePage(index)}
          />
        ))}
      </View>

      {/* Page Navigation */}
      <View style={styles.navContainer}>
        <TouchableOpacity
          style={[styles.navArrow, activePage === 0 && styles.navArrowDisabled]}
          onPress={() => setActivePage(Math.max(0, activePage - 1))}
          disabled={activePage === 0}
        >
          <Ionicons
            name="chevron-back-circle"
            size={44}
            color={activePage === 0 ? colors.gray300 : colors.primary}
          />
        </TouchableOpacity>

        <View style={styles.navInfo}>
          <Text style={styles.navInfoText}>
            Page {activePage + 1} of {pages.length}
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/page-builder')}
            style={styles.editButton}
          >
            <Ionicons name="pencil" size={16} color={colors.primary} />
            <Text style={styles.editButtonText}>Edit this page</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.navArrow, activePage === pages.length - 1 && styles.navArrowDisabled]}
          onPress={() => setActivePage(Math.min(pages.length - 1, activePage + 1))}
          disabled={activePage === pages.length - 1}
        >
          <Ionicons
            name="chevron-forward-circle"
            size={44}
            color={activePage === pages.length - 1 ? colors.gray300 : colors.primary}
          />
        </TouchableOpacity>
      </View>

      {/* Story Summary Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerHook}>"{currentProject.hook}"</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  exportButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  bookHeader: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  bookTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  bookMeta: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  spreadContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  spread: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 700,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.lg,
  },
  illustrationSide: {
    flex: 1,
    backgroundColor: '#EEF2FF',
    padding: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 280,
  },
  illustrationPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.gray200,
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
    width: '90%',
    aspectRatio: 1,
    backgroundColor: colors.white,
  },
  illustrationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray400,
    marginTop: spacing.sm,
  },
  illustrationHint: {
    fontSize: 12,
    color: colors.gray400,
  },
  promptPreview: {
    marginTop: spacing.md,
    width: '100%',
    padding: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: borderRadius.sm,
  },
  promptPreviewLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  promptPreviewText: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  textSide: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
    position: 'relative',
  },
  pageNumberBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  pageText: {
    fontSize: 16,
    color: colors.textPrimary,
    lineHeight: 28,
    fontFamily: 'Georgia',
  },
  emptyTextContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: 14,
    color: colors.gray400,
    marginTop: spacing.sm,
  },
  emotionalBeatTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.md,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#FDF4FF',
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  emotionalBeatText: {
    fontSize: 11,
    color: colors.secondary,
    fontStyle: 'italic',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.gray300,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 24,
  },
  dotComplete: {
    backgroundColor: colors.success,
  },
  navContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.xl,
  },
  navArrow: {
    padding: spacing.xs,
  },
  navArrowDisabled: {
    opacity: 0.5,
  },
  navInfo: {
    alignItems: 'center',
  },
  navInfoText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  editButtonText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
  },
  footerHook: {
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
