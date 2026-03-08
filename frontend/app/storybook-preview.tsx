import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Image,
  Modal,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { colors, spacing, borderRadius, shadows } from '../src/utils/theme';
import { Card } from '../src/components/Card';
import { Button } from '../src/components/Button';
import { Loading } from '../src/components/Loading';
import { useProject } from '../src/context/ProjectContext';
import { api, BASE_URL, buildImageUrl } from '../src/utils/api';

const { width: SCREEN_W } = Dimensions.get('window');
const PREVIEW_WIDTH = Math.min(SCREEN_W - 48, 600);

// Style preset metadata (mirrors backend STYLE_PRESETS)
const STYLE_PRESETS = [
  { key: 'watercolor', label: 'Storybook Watercolor', emoji: '🎨' },
  { key: 'pastel', label: 'Soft Pastel Bedtime', emoji: '🌙' },
  { key: 'cartoon', label: 'Cartoon Picture Book', emoji: '🖍️' },
  { key: 'flat_modern', label: 'Flat Modern Illustration', emoji: '✏️' },
];

export default function StorybookPreviewScreen() {
  const router = useRouter();
  const { currentProject, pages, characters, isLoading, updatePage } = useProject();

  const [activePage, setActivePage] = useState(0);
  const [generatingPageId, setGeneratingPageId] = useState<string | null>(null);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<string>(
    currentProject?.illustration_style || 'watercolor'
  );
  const [isSavingStyle, setIsSavingStyle] = useState(false);
  const [showFullscreenImage, setShowFullscreenImage] = useState(false);

  if (isLoading || !currentProject) {
    return <Loading message="Loading storybook..." fullScreen />;
  }

  const currentPageData = pages[activePage];
  const illustratedCount = pages.filter((p) => p.illustration_url).length;

  const handleGenerateSingle = useCallback(async () => {
    if (!currentPageData) return;
    if (!currentPageData.illustration_prompt) {
      Alert.alert('No Prompt', 'Generate an illustration prompt for this page first in the Page Builder.');
      return;
    }
    setGeneratingPageId(currentPageData.id);
    try {
      const res = await api.post(
        `/projects/${currentProject.id}/pages/${currentPageData.id}/illustrations/generate`
      );
      updatePage(currentPageData.id, { illustration_url: res.data.illustration_url });
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to generate illustration.';
      Alert.alert('Generation Failed', msg);
    } finally {
      setGeneratingPageId(null);
    }
  }, [currentPageData, currentProject, updatePage]);

  const handleDeleteIllustration = useCallback(async () => {
    if (!currentPageData) return;
    Alert.alert(
      'Remove Illustration',
      'Remove the illustration from this page?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(
                `/projects/${currentProject.id}/pages/${currentPageData.id}/illustrations`
              );
              updatePage(currentPageData.id, { illustration_url: '' });
            } catch {
              Alert.alert('Error', 'Failed to remove illustration.');
            }
          },
        },
      ]
    );
  }, [currentPageData, currentProject, updatePage]);

  const handleDownloadIllustration = useCallback(async () => {
    if (!currentPageData?.illustration_url) return;
    const fullUrl = buildImageUrl(currentPageData.illustration_url);
    if (Platform.OS === 'web') {
      const a = document.createElement('a');
      a.href = fullUrl;
      a.download = `page_${currentPageData.page_number}.png`;
      a.click();
    } else {
      await Linking.openURL(fullUrl);
    }
  }, [currentPageData]);

  const handleSaveStyle = useCallback(async () => {
    setIsSavingStyle(true);
    try {
      await api.put(`/projects/${currentProject.id}/illustration-style`, {
        style_preset: selectedStyle,
      });
      setShowStylePicker(false);
    } catch {
      Alert.alert('Error', 'Failed to save style setting.');
    } finally {
      setIsSavingStyle(false);
    }
  }, [currentProject, selectedStyle]);

  const handleBatchGenerate = useCallback(async () => {
    const pagesWithPrompts = pages.filter((p) => p.illustration_prompt);
    if (pagesWithPrompts.length === 0) {
      Alert.alert('No Prompts', 'Generate illustration prompts for your pages first.');
      return;
    }

    Alert.alert(
      'Illustrate Entire Book',
      `Generate illustrations for ${pagesWithPrompts.length} page(s)? This may take a few minutes.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Illustrate',
          onPress: async () => {
            setIsBatchGenerating(true);
            setBatchProgress({ current: 0, total: pagesWithPrompts.length });
            try {
              const res = await api.post(
                `/projects/${currentProject.id}/illustrations/batch`
              );
              const results: Array<{ page_id: string; status: string; illustration_url?: string }> = res.data.results || [];
              // Refresh pages with new URLs
              for (const r of results) {
                if (r.status === 'success' && r.illustration_url) {
                  updatePage(r.page_id, { illustration_url: r.illustration_url });
                }
              }
              const { success_count, skip_count, fail_count } = res.data;
              Alert.alert(
                'Illustrations Complete',
                `Generated: ${success_count} ✅  Skipped (no prompt): ${skip_count}  Failed: ${fail_count}`
              );
            } catch (err: any) {
              const msg = err?.response?.data?.detail || 'Batch generation failed.';
              Alert.alert('Generation Failed', msg);
            } finally {
              setIsBatchGenerating(false);
              setBatchProgress(null);
            }
          },
        },
      ]
    );
  }, [pages, currentProject, updatePage]);

  const isGeneratingCurrent = generatingPageId === currentPageData?.id;
  const currentImageUrl = buildImageUrl(currentPageData?.illustration_url || '');

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Ionicons name="albums" size={24} color={colors.primary} />
          <Text style={styles.title}>Storybook Preview</Text>
        </View>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.push('/export')}
        >
          <Ionicons name="download-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* ── Book title + style selector ── */}
      <View style={styles.bookHeader}>
        <Text style={styles.bookTitle}>{currentProject.title}</Text>
        <View style={styles.bookMeta}>
          <Text style={styles.bookMetaText}>
            Ages {currentProject.age_range} • {pages.length} pages • {illustratedCount}/{pages.length} illustrated
          </Text>
          <TouchableOpacity style={styles.styleButton} onPress={() => setShowStylePicker(true)}>
            <Text style={styles.styleButtonEmoji}>
              {STYLE_PRESETS.find((s) => s.key === (currentProject.illustration_style || selectedStyle))?.emoji ?? '🎨'}
            </Text>
            <Text style={styles.styleButtonLabel}>Style</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Batch progress banner ── */}
      {isBatchGenerating && (
        <View style={styles.batchBanner}>
          <ActivityIndicator size="small" color={colors.white} />
          <Text style={styles.batchBannerText}>
            Generating illustrations… this may take a few minutes
          </Text>
        </View>
      )}

      {/* ── Storybook Spread ── */}
      <View style={styles.spreadContainer}>
        <View style={styles.spread}>
          {/* Left: Illustration */}
          <TouchableOpacity
            style={styles.illustrationSide}
            onPress={currentImageUrl ? () => setShowFullscreenImage(true) : undefined}
            activeOpacity={currentImageUrl ? 0.85 : 1}
          >
            {isGeneratingCurrent ? (
              <View style={styles.illustrationGenerating}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.generatingText}>Generating…</Text>
              </View>
            ) : currentImageUrl ? (
              <Image
                source={{ uri: currentImageUrl }}
                style={styles.illustrationImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.illustrationPlaceholder}>
                <Ionicons name="image" size={48} color={colors.gray300} />
                <Text style={styles.illustrationLabel}>Illustration</Text>
                <Text style={styles.illustrationHint}>Page {currentPageData?.page_number}</Text>
                {currentPageData?.illustration_prompt && (
                  <Text style={styles.illustrationPromptPreview} numberOfLines={2}>
                    {currentPageData.illustration_prompt.slice(0, 80)}…
                  </Text>
                )}
              </View>
            )}
          </TouchableOpacity>

          {/* Right: Text */}
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

      {/* ── Per-page illustration controls ── */}
      <View style={styles.pageControls}>
        <TouchableOpacity
          style={[styles.pageControlBtn, isGeneratingCurrent && styles.pageControlBtnDisabled]}
          onPress={handleGenerateSingle}
          disabled={isGeneratingCurrent || isBatchGenerating}
        >
          <Ionicons name="sparkles" size={16} color={isGeneratingCurrent ? colors.gray400 : colors.primary} />
          <Text style={[styles.pageControlText, isGeneratingCurrent && { color: colors.gray400 }]}>
            {isGeneratingCurrent ? 'Generating…' : currentImageUrl ? 'Regenerate' : 'Generate'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.pageControlBtn}
          onPress={() => router.push('/page-builder')}
        >
          <Ionicons name="create-outline" size={16} color={colors.primary} />
          <Text style={styles.pageControlText}>Edit</Text>
        </TouchableOpacity>

        {currentImageUrl ? (
          <>
            <TouchableOpacity style={styles.pageControlBtn} onPress={handleDownloadIllustration}>
              <Ionicons name="download-outline" size={16} color={colors.primary} />
              <Text style={styles.pageControlText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pageControlBtn} onPress={handleDeleteIllustration}>
              <Ionicons name="trash-outline" size={16} color={colors.error} />
              <Text style={[styles.pageControlText, { color: colors.error }]}>Remove</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>

      {/* ── Page navigation dots ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dotsContainer}>
        {pages.map((page, index) => (
          <TouchableOpacity
            key={page.id}
            style={[
              styles.dot,
              index === activePage && styles.dotActive,
              page.illustration_url && styles.dotIllustrated,
              page.page_text && !page.illustration_url && styles.dotTextOnly,
            ]}
            onPress={() => setActivePage(index)}
          />
        ))}
      </ScrollView>

      {/* ── Navigation arrows ── */}
      <View style={styles.navContainer}>
        <TouchableOpacity
          style={[styles.navArrow, activePage === 0 && styles.navArrowDisabled]}
          onPress={() => setActivePage(Math.max(0, activePage - 1))}
          disabled={activePage === 0}
        >
          <Ionicons name="chevron-back-circle" size={44} color={activePage === 0 ? colors.gray300 : colors.primary} />
        </TouchableOpacity>

        <View style={styles.navCenter}>
          <Text style={styles.navInfoText}>Page {activePage + 1} of {pages.length}</Text>
          <TouchableOpacity
            style={[styles.illustrateBookBtn, isBatchGenerating && styles.illustrateBookBtnDisabled]}
            onPress={handleBatchGenerate}
            disabled={isBatchGenerating}
          >
            <Ionicons name="images" size={16} color={isBatchGenerating ? colors.gray400 : colors.white} />
            <Text style={[styles.illustrateBookText, isBatchGenerating && { color: colors.gray400 }]}>
              {isBatchGenerating ? 'Illustrating…' : 'Illustrate Entire Book'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.navArrow, activePage === pages.length - 1 && styles.navArrowDisabled]}
          onPress={() => setActivePage(Math.min(pages.length - 1, activePage + 1))}
          disabled={activePage === pages.length - 1}
        >
          <Ionicons name="chevron-forward-circle" size={44} color={activePage === pages.length - 1 ? colors.gray300 : colors.primary} />
        </TouchableOpacity>
      </View>

      {/* ── Footer hook ── */}
      <View style={styles.footer}>
        <Text style={styles.footerHook}>"{currentProject.hook}"</Text>
      </View>

      {/* ── Style Picker Modal ── */}
      <Modal visible={showStylePicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Illustration Style</Text>
            <Text style={styles.modalSubtitle}>
              Choose a style for the entire book. All illustrations will use this style.
            </Text>
            {STYLE_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset.key}
                style={[styles.styleOption, selectedStyle === preset.key && styles.styleOptionActive]}
                onPress={() => setSelectedStyle(preset.key)}
              >
                <Text style={styles.styleOptionEmoji}>{preset.emoji}</Text>
                <Text style={[styles.styleOptionLabel, selectedStyle === preset.key && styles.styleOptionLabelActive]}>
                  {preset.label}
                </Text>
                {selectedStyle === preset.key && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
            <View style={styles.modalActions}>
              <Button title="Cancel" onPress={() => setShowStylePicker(false)} variant="outline" size="md" />
              <Button title={isSavingStyle ? 'Saving…' : 'Save Style'} onPress={handleSaveStyle} loading={isSavingStyle} size="md" />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Fullscreen Image Modal ── */}
      <Modal visible={showFullscreenImage && !!currentImageUrl} transparent animationType="fade">
        <TouchableOpacity
          style={styles.fullscreenOverlay}
          activeOpacity={1}
          onPress={() => setShowFullscreenImage(false)}
        >
          <Image
            source={{ uri: currentImageUrl }}
            style={styles.fullscreenImage}
            resizeMode="contain"
          />
          <TouchableOpacity style={styles.fullscreenClose} onPress={() => setShowFullscreenImage(false)}>
            <Ionicons name="close-circle" size={36} color={colors.white} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md,
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: borderRadius.full,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
    ...shadows.sm,
  },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },

  // Book header
  bookHeader: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  bookTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  bookMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  bookMetaText: { fontSize: 12, color: colors.textMuted },
  styleButton: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#EEF2FF', borderRadius: borderRadius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  styleButtonEmoji: { fontSize: 14 },
  styleButtonLabel: { fontSize: 12, color: colors.primary, fontWeight: '600' },

  // Batch banner
  batchBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.primary, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg,
  },
  batchBannerText: { fontSize: 13, color: colors.white, fontWeight: '500', flex: 1 },

  // Spread
  spreadContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  spread: {
    flexDirection: 'row', width: '100%', maxWidth: 700,
    backgroundColor: colors.white, borderRadius: borderRadius.lg, overflow: 'hidden', ...shadows.md,
  },

  // Illustration side
  illustrationSide: {
    flex: 1, backgroundColor: '#EEF2FF', minHeight: 240,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  illustrationImage: { width: '100%', height: '100%', minHeight: 240 },
  illustrationGenerating: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl },
  generatingText: { fontSize: 13, color: colors.primary, fontWeight: '500' },
  illustrationPlaceholder: {
    alignItems: 'center', justifyContent: 'center', padding: spacing.lg,
    borderWidth: 2, borderColor: colors.gray200, borderStyle: 'dashed',
    borderRadius: borderRadius.md, margin: spacing.md, width: '85%',
  },
  illustrationLabel: { fontSize: 14, fontWeight: '600', color: colors.gray400, marginTop: spacing.sm },
  illustrationHint: { fontSize: 12, color: colors.gray400 },
  illustrationPromptPreview: { fontSize: 10, color: colors.gray400, marginTop: 4, textAlign: 'center' },

  // Text side
  textSide: { flex: 1, padding: spacing.lg, justifyContent: 'center', position: 'relative' },
  pageNumberBadge: {
    position: 'absolute', top: spacing.md, right: spacing.md,
    width: 28, height: 28, borderRadius: borderRadius.full,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  pageNumberText: { fontSize: 14, fontWeight: '700', color: colors.white },
  pageText: { fontSize: 16, color: colors.textPrimary, lineHeight: 28, fontFamily: 'Georgia' },
  emptyTextContainer: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyText: { fontSize: 14, color: colors.gray400, marginTop: spacing.sm },
  emotionalBeatTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.md,
    paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#FDF4FF',
    borderRadius: borderRadius.full, alignSelf: 'flex-start',
  },
  emotionalBeatText: { fontSize: 11, color: colors.secondary, fontStyle: 'italic' },

  // Page controls
  pageControls: {
    flexDirection: 'row', justifyContent: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.lg,
  },
  pageControlBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.md, paddingVertical: 6,
    backgroundColor: colors.white, borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: colors.gray200, ...shadows.sm,
  },
  pageControlBtnDisabled: { opacity: 0.5 },
  pageControlText: { fontSize: 12, color: colors.primary, fontWeight: '600' },

  // Navigation dots
  dotsContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.lg,
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gray300 },
  dotActive: { backgroundColor: colors.primary, width: 24 },
  dotIllustrated: { backgroundColor: colors.success },
  dotTextOnly: { backgroundColor: colors.warning },

  // Navigation
  navContainer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingBottom: spacing.sm,
  },
  navArrow: { padding: spacing.xs },
  navArrowDisabled: { opacity: 0.5 },
  navCenter: { alignItems: 'center', gap: spacing.xs },
  navInfoText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  illustrateBookBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md, paddingVertical: 8, ...shadows.sm,
  },
  illustrateBookBtnDisabled: { backgroundColor: colors.gray200 },
  illustrateBookText: { fontSize: 13, color: colors.white, fontWeight: '700' },

  // Footer
  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, alignItems: 'center' },
  footerHook: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic', textAlign: 'center' },

  // Style picker modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.xl, paddingBottom: spacing.xxl,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.xs },
  modalSubtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg, lineHeight: 18 },
  styleOption: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.gray200,
  },
  styleOptionActive: { borderColor: colors.primary, backgroundColor: '#EEF2FF' },
  styleOptionEmoji: { fontSize: 24 },
  styleOptionLabel: { flex: 1, fontSize: 15, color: colors.textSecondary, fontWeight: '500' },
  styleOptionLabelActive: { color: colors.primary, fontWeight: '700' },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg, justifyContent: 'flex-end' },

  // Fullscreen image
  fullscreenOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  fullscreenImage: { width: SCREEN_W, height: SCREEN_W },
  fullscreenClose: { position: 'absolute', top: 48, right: 20 },
});
