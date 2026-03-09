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
import { useProject, PageLayoutData } from '../src/context/ProjectContext';
import { api, BASE_URL, buildImageUrl } from '../src/utils/api';

const { width: SCREEN_W } = Dimensions.get('window');

// Style preset metadata (mirrors backend STYLE_PRESETS)
const STYLE_PRESETS = [
  { key: 'watercolor', label: 'Storybook Watercolor', emoji: '🎨' },
  { key: 'pastel', label: 'Soft Pastel Bedtime', emoji: '🌙' },
  { key: 'cartoon', label: 'Cartoon Picture Book', emoji: '🖍️' },
  { key: 'flat_modern', label: 'Flat Modern Illustration', emoji: '✏️' },
];

// Page theme metadata (mirrors backend PAGE_THEMES)
const PAGE_THEMES = [
  { key: 'cozy_bedtime',     label: 'Cozy Bedtime',      emoji: '🌙', bgColor: '#FFF8F0', textColor: '#2C1810' },
  { key: 'bright_storybook', label: 'Bright Storybook',  emoji: '🌈', bgColor: '#FFFFFF', textColor: '#1A1A2E' },
  { key: 'watercolor_calm',  label: 'Watercolor Calm',   emoji: '🎨', bgColor: '#F5F0EB', textColor: '#3D2B1F' },
  { key: 'comic_adventure',  label: 'Comic Adventure',   emoji: '💥', bgColor: '#FFFDE7', textColor: '#1C1C1C' },
];

const LAYOUT_TYPE_LABELS: Record<string, string> = {
  full_illustration_text_bottom:   '🖼️ Full Illus. + Text Bottom',
  full_illustration_text_overlay:  '✨ Full Illus. + Text Overlay',
  split_top_bottom:                '⬆️ Split Layout',
  full_spread:                     '📖 Full Spread',
  spot_illustration:               '🔍 Spot Illustration',
};

// ── Layout-aware spread renderer ──────────────────────────────────────────────

interface LayoutAwareSpreadProps {
  imageUrl: string;
  pageText: string;
  pageNumber: number;
  emotionalBeat: string;
  illustrationPrompt: string;
  layout: PageLayoutData | null;
  theme: typeof PAGE_THEMES[0];
  isGenerating: boolean;
  onPressImage: () => void;
}

function LayoutAwareSpread({
  imageUrl,
  pageText,
  pageNumber,
  emotionalBeat,
  illustrationPrompt,
  layout,
  theme,
  isGenerating,
  onPressImage,
}: LayoutAwareSpreadProps) {
  const layoutType = layout?.layout_type ?? 'split_top_bottom';
  const hasImage = !!imageUrl;

  const imageEl = isGenerating ? (
    <View style={[spreadStyles.imagePlaceholder, { backgroundColor: theme.bgColor }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={spreadStyles.generatingText}>Generating...</Text>
    </View>
  ) : hasImage ? (
    <TouchableOpacity style={spreadStyles.imageFull} onPress={onPressImage} activeOpacity={0.85}>
      <Image source={{ uri: imageUrl }} style={spreadStyles.imageFullImg} resizeMode="cover" />
    </TouchableOpacity>
  ) : (
    <View style={[spreadStyles.imagePlaceholder, { backgroundColor: theme.bgColor }]}>
      <Ionicons name="image-outline" size={40} color={colors.gray300} />
      <Text style={spreadStyles.placeholderLabel}>Page {pageNumber}</Text>
      {illustrationPrompt ? (
        <Text style={spreadStyles.promptPreview} numberOfLines={2}>
          {illustrationPrompt.slice(0, 80)}...
        </Text>
      ) : null}
    </View>
  );

  const textEl = (
    <View style={[spreadStyles.textBlock, { backgroundColor: theme.bgColor }]}>
      <View style={spreadStyles.pageNumBadge}>
        <Text style={spreadStyles.pageNumText}>{pageNumber}</Text>
      </View>
      {pageText ? (
        <Text style={[spreadStyles.pageText, { color: theme.textColor }]}>{pageText}</Text>
      ) : (
        <Text style={spreadStyles.emptyText}>No text yet</Text>
      )}
      {emotionalBeat ? (
        <View style={spreadStyles.beatTag}>
          <Ionicons name="heart" size={11} color={colors.secondary} />
          <Text style={spreadStyles.beatText}>{emotionalBeat}</Text>
        </View>
      ) : null}
    </View>
  );

  // ── Layout rendering ─────────────────────────────────────────────────────

  if (layoutType === 'full_illustration_text_overlay') {
    return (
      <View style={spreadStyles.root}>
        {/* Full bleed image */}
        {isGenerating ? (
          imageEl
        ) : hasImage ? (
          <TouchableOpacity style={spreadStyles.fullBleed} onPress={onPressImage} activeOpacity={0.85}>
            <Image source={{ uri: imageUrl }} style={spreadStyles.fullBleedImg} resizeMode="cover" />
            {/* Text overlay strip */}
            <View style={[spreadStyles.overlayStrip, { backgroundColor: theme.bgColor + 'DD' }]}>
              {pageText ? (
                <Text style={[spreadStyles.overlayText, { color: theme.textColor }]}>{pageText}</Text>
              ) : (
                <Text style={spreadStyles.emptyText}>No text yet</Text>
              )}
              {emotionalBeat ? (
                <View style={spreadStyles.beatTag}>
                  <Ionicons name="heart" size={11} color={colors.secondary} />
                  <Text style={spreadStyles.beatText}>{emotionalBeat}</Text>
                </View>
              ) : null}
            </View>
            <View style={spreadStyles.pageNumBadgeAbs}>
              <Text style={spreadStyles.pageNumText}>{pageNumber}</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={spreadStyles.fullBleed}>
            {imageEl}
          </View>
        )}
      </View>
    );
  }

  if (layoutType === 'full_spread') {
    return (
      <View style={spreadStyles.root}>
        {/* Wide image takes most of the height */}
        <View style={spreadStyles.spreadImageContainer}>{imageEl}</View>
        {/* Narrow text strip at bottom */}
        <View style={[spreadStyles.spreadTextStrip, { backgroundColor: theme.bgColor }]}>
          <View style={spreadStyles.pageNumBadge}>
            <Text style={spreadStyles.pageNumText}>{pageNumber}</Text>
          </View>
          {pageText ? (
            <Text style={[spreadStyles.spreadText, { color: theme.textColor }]}>{pageText}</Text>
          ) : (
            <Text style={spreadStyles.emptyText}>No text yet</Text>
          )}
          {emotionalBeat ? (
            <View style={spreadStyles.beatTag}>
              <Ionicons name="heart" size={11} color={colors.secondary} />
              <Text style={spreadStyles.beatText}>{emotionalBeat}</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  if (layoutType === 'full_illustration_text_bottom') {
    return (
      <View style={spreadStyles.root}>
        <View style={spreadStyles.topImageLarge}>{imageEl}</View>
        {textEl}
      </View>
    );
  }

  if (layoutType === 'spot_illustration') {
    return (
      <View style={[spreadStyles.rootRow, { backgroundColor: theme.bgColor }]}>
        {/* Large text area on left */}
        <View style={spreadStyles.spotTextArea}>
          <View style={spreadStyles.pageNumBadge}>
            <Text style={spreadStyles.pageNumText}>{pageNumber}</Text>
          </View>
          {pageText ? (
            <Text style={[spreadStyles.spotText, { color: theme.textColor }]}>{pageText}</Text>
          ) : (
            <Text style={spreadStyles.emptyText}>No text yet</Text>
          )}
          {emotionalBeat ? (
            <View style={spreadStyles.beatTag}>
              <Ionicons name="heart" size={11} color={colors.secondary} />
              <Text style={spreadStyles.beatText}>{emotionalBeat}</Text>
            </View>
          ) : null}
        </View>
        {/* Small spot image on right */}
        <View style={spreadStyles.spotImageArea}>{imageEl}</View>
      </View>
    );
  }

  // Default: split_top_bottom — left image / right text (original layout)
  return (
    <View style={spreadStyles.rootRow}>
      <View style={spreadStyles.splitImageHalf}>{imageEl}</View>
      {textEl}
    </View>
  );
}

const spreadStyles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'column', overflow: 'hidden' },
  rootRow: { flex: 1, flexDirection: 'row', overflow: 'hidden' },

  // Full bleed (overlay)
  fullBleed: { flex: 1, position: 'relative' },
  fullBleedImg: { width: '100%', height: '100%', minHeight: 240 },
  overlayStrip: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: spacing.md, paddingBottom: spacing.lg,
  },
  overlayText: { fontSize: 16, lineHeight: 26, textAlign: 'center', fontFamily: 'Georgia' },
  pageNumBadgeAbs: {
    position: 'absolute', top: spacing.md, right: spacing.md,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },

  // Spread layout
  spreadImageContainer: { flex: 3, overflow: 'hidden' },
  spreadTextStrip: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm,
  },
  spreadText: { flex: 1, fontSize: 15, lineHeight: 24, fontFamily: 'Georgia' },

  // Full illus + text bottom
  topImageLarge: { flex: 3, overflow: 'hidden' },

  // Spot illustration
  spotTextArea: { flex: 3, padding: spacing.lg, justifyContent: 'center' },
  spotText: { fontSize: 16, lineHeight: 26, fontFamily: 'Georgia' },
  spotImageArea: { flex: 2, overflow: 'hidden', borderRadius: borderRadius.md, margin: spacing.md },

  // Split (default)
  splitImageHalf: { flex: 1, backgroundColor: '#EEF2FF', overflow: 'hidden' },

  // Shared
  imageFull: { flex: 1, overflow: 'hidden' },
  imageFullImg: { width: '100%', height: '100%', minHeight: 240 },
  imagePlaceholder: {
    flex: 1, minHeight: 200, alignItems: 'center', justifyContent: 'center',
    padding: spacing.lg,
  },
  placeholderLabel: { fontSize: 13, color: colors.gray400, marginTop: spacing.sm },
  promptPreview: { fontSize: 10, color: colors.gray400, marginTop: 4, textAlign: 'center' },
  generatingText: { fontSize: 13, color: colors.primary, fontWeight: '500', marginTop: spacing.sm },

  textBlock: { flex: 1, padding: spacing.lg, justifyContent: 'center', position: 'relative' },
  pageNumBadge: {
    position: 'absolute', top: spacing.md, right: spacing.md,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  pageNumText: { fontSize: 12, fontWeight: '700', color: colors.white },
  pageText: { fontSize: 16, lineHeight: 28, fontFamily: 'Georgia' },
  emptyText: { fontSize: 14, color: colors.gray400 },
  beatTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm,
    paddingVertical: 3, paddingHorizontal: 8, backgroundColor: '#FDF4FF',
    borderRadius: borderRadius.full, alignSelf: 'flex-start',
  },
  beatText: { fontSize: 10, color: colors.secondary, fontStyle: 'italic' },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function StorybookPreviewScreen() {
  const router = useRouter();
  const { currentProject, pages, characters, isLoading, updatePage, updateProject } = useProject();

  const [activePage, setActivePage] = useState(0);
  const [generatingPageId, setGeneratingPageId] = useState<string | null>(null);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<string>(
    currentProject?.illustration_style || 'watercolor'
  );
  const [selectedTheme, setSelectedTheme] = useState<string>(
    currentProject?.page_theme || 'cozy_bedtime'
  );
  const [isSavingStyle, setIsSavingStyle] = useState(false);
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [isAutoLayouting, setIsAutoLayouting] = useState(false);
  const [isBatchLayouting, setIsBatchLayouting] = useState(false);
  const [showFullscreenImage, setShowFullscreenImage] = useState(false);

  if (isLoading || !currentProject) {
    return <Loading message="Loading storybook..." fullScreen />;
  }

  const currentPageData = pages[activePage];
  const illustratedCount = pages.filter((p) => p.illustration_url).length;
  const laidOutCount = pages.filter((p) => p.page_layout).length;

  const activeTheme = PAGE_THEMES.find((t) => t.key === (currentProject.page_theme || selectedTheme))
    ?? PAGE_THEMES[0];

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

  const handleSaveTheme = useCallback(async () => {
    setIsSavingTheme(true);
    try {
      await api.put(`/projects/${currentProject.id}/page-theme`, {
        theme_key: selectedTheme,
      });
      updateProject({ page_theme: selectedTheme });
      setShowThemePicker(false);
    } catch {
      Alert.alert('Error', 'Failed to save theme setting.');
    } finally {
      setIsSavingTheme(false);
    }
  }, [currentProject, selectedTheme, updateProject]);

  const handleAutoLayoutCurrent = useCallback(async () => {
    if (!currentPageData) return;
    setIsAutoLayouting(true);
    try {
      const res = await api.post(
        `/projects/${currentProject.id}/pages/${currentPageData.id}/layout/auto`
      );
      updatePage(currentPageData.id, { page_layout: res.data.page_layout });
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Auto layout failed.';
      Alert.alert('Layout Failed', msg);
    } finally {
      setIsAutoLayouting(false);
    }
  }, [currentPageData, currentProject, updatePage]);

  const handleBatchLayout = useCallback(async () => {
    Alert.alert(
      'Auto Layout Entire Book',
      `Apply smart layout to all ${pages.length} pages?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply Layout',
          onPress: async () => {
            setIsBatchLayouting(true);
            try {
              const res = await api.post(`/projects/${currentProject.id}/layout/batch`);
              const results: Array<{ page_id: string; layout_type: string; page_layout: PageLayoutData }> = res.data.results || [];
              // Update each page's layout in context
              for (const r of results) {
                updatePage(r.page_id, { page_layout: r.page_layout });
              }
              Alert.alert(
                'Layout Applied',
                `Smart layout applied to ${res.data.layouts_applied} pages.`
              );
            } catch (err: any) {
              const msg = err?.response?.data?.detail || 'Batch layout failed.';
              Alert.alert('Layout Failed', msg);
            } finally {
              setIsBatchLayouting(false);
            }
          },
        },
      ]
    );
  }, [pages, currentProject, updatePage]);

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
  const currentLayout = currentPageData?.page_layout ?? null;
  const currentLayoutLabel = currentLayout
    ? (LAYOUT_TYPE_LABELS[currentLayout.layout_type] ?? currentLayout.layout_type)
    : null;

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
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => router.push('/cover-generator')}
          >
            <Ionicons name="book-outline" size={20} color={colors.secondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => router.push('/export')}
          >
            <Ionicons name="download-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Book title + style/theme selectors ── */}
      <View style={styles.bookHeader}>
        <Text style={styles.bookTitle}>{currentProject.title}</Text>
        <View style={styles.bookMeta}>
          <Text style={styles.bookMetaText}>
            Ages {currentProject.age_range},{' '}
            {pages.length} pages,{' '}
            {illustratedCount}/{pages.length} illustrated,{' '}
            {laidOutCount}/{pages.length} laid out
          </Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.styleButton} onPress={() => setShowStylePicker(true)}>
              <Text style={styles.styleButtonEmoji}>
                {STYLE_PRESETS.find((s) => s.key === (currentProject.illustration_style || selectedStyle))?.emoji ?? '🎨'}
              </Text>
              <Text style={styles.styleButtonLabel}>Style</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.styleButton} onPress={() => setShowThemePicker(true)}>
              <Text style={styles.styleButtonEmoji}>{activeTheme.emoji}</Text>
              <Text style={styles.styleButtonLabel}>Theme</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Batch progress banner ── */}
      {isBatchGenerating && (
        <View style={styles.batchBanner}>
          <ActivityIndicator size="small" color={colors.white} />
          <Text style={styles.batchBannerText}>
            Generating illustrations... this may take a few minutes
          </Text>
        </View>
      )}
      {isBatchLayouting && (
        <View style={[styles.batchBanner, { backgroundColor: colors.secondary }]}>
          <ActivityIndicator size="small" color={colors.white} />
          <Text style={styles.batchBannerText}>Applying smart layout to all pages...</Text>
        </View>
      )}

      {/* ── Layout type badge ── */}
      {currentLayoutLabel && (
        <View style={styles.layoutBadgeRow}>
          <View style={styles.layoutBadge}>
            <Text style={styles.layoutBadgeText}>{currentLayoutLabel}</Text>
          </View>
        </View>
      )}

      {/* ── Storybook Spread (layout-aware) ── */}
      <View style={[styles.spreadContainer, { backgroundColor: activeTheme.bgColor }]}>
        <View style={[styles.spread, { backgroundColor: activeTheme.bgColor }]}>
          <LayoutAwareSpread
            imageUrl={currentImageUrl}
            pageText={currentPageData?.page_text ?? ''}
            pageNumber={currentPageData?.page_number ?? 0}
            emotionalBeat={currentPageData?.emotional_beat ?? ''}
            illustrationPrompt={currentPageData?.illustration_prompt ?? ''}
            layout={currentLayout}
            theme={activeTheme}
            isGenerating={isGeneratingCurrent}
            onPressImage={() => setShowFullscreenImage(true)}
          />
        </View>
      </View>

      {/* ── Per-page illustration + layout controls ── */}
      <View style={styles.pageControls}>
        <TouchableOpacity
          style={[styles.pageControlBtn, isGeneratingCurrent && styles.pageControlBtnDisabled]}
          onPress={handleGenerateSingle}
          disabled={isGeneratingCurrent || isBatchGenerating}
        >
          <Ionicons name="sparkles" size={16} color={isGeneratingCurrent ? colors.gray400 : colors.primary} />
          <Text style={[styles.pageControlText, isGeneratingCurrent && { color: colors.gray400 }]}>
            {isGeneratingCurrent ? 'Generating...' : currentImageUrl ? 'Regenerate' : 'Generate'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.pageControlBtn, isAutoLayouting && styles.pageControlBtnDisabled]}
          onPress={handleAutoLayoutCurrent}
          disabled={isAutoLayouting || isBatchLayouting}
        >
          <Ionicons name="grid-outline" size={16} color={isAutoLayouting ? colors.gray400 : colors.secondary} />
          <Text style={[styles.pageControlText, { color: isAutoLayouting ? colors.gray400 : colors.secondary }]}>
            {isAutoLayouting ? 'Laying out...' : 'Auto Layout'}
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

      {/* ── Navigation arrows + action buttons ── */}
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
          <View style={styles.navActionRow}>
            <TouchableOpacity
              style={[styles.navActionBtn, styles.navActionBtnLayout, isBatchLayouting && styles.illustrateBookBtnDisabled]}
              onPress={handleBatchLayout}
              disabled={isBatchLayouting || isBatchGenerating}
            >
              <Ionicons name="grid" size={15} color={isBatchLayouting ? colors.gray400 : colors.white} />
              <Text style={[styles.navActionBtnText, isBatchLayouting && { color: colors.gray400 }]}>
                {isBatchLayouting ? 'Laying out...' : 'Layout All'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.illustrateBookBtn, isBatchGenerating && styles.illustrateBookBtnDisabled]}
              onPress={handleBatchGenerate}
              disabled={isBatchGenerating}
            >
              <Ionicons name="images" size={15} color={isBatchGenerating ? colors.gray400 : colors.white} />
              <Text style={[styles.illustrateBookText, isBatchGenerating && { color: colors.gray400 }]}>
                {isBatchGenerating ? 'Illustrating...' : 'Illustrate All'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navActionBtn, styles.navActionBtnCover]}
              onPress={() => router.push('/cover-generator')}
            >
              <Ionicons name="book" size={15} color={colors.white} />
              <Text style={styles.navActionBtnText}>Cover</Text>
            </TouchableOpacity>
          </View>
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
              <Button title={isSavingStyle ? 'Saving...' : 'Save Style'} onPress={handleSaveStyle} loading={isSavingStyle} size="md" />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Theme Picker Modal ── */}
      <Modal visible={showThemePicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Page Theme</Text>
            <Text style={styles.modalSubtitle}>
              Choose typography and color style for the book's pages.
            </Text>
            {PAGE_THEMES.map((theme) => (
              <TouchableOpacity
                key={theme.key}
                style={[styles.styleOption, selectedTheme === theme.key && styles.styleOptionActive, { backgroundColor: selectedTheme === theme.key ? theme.bgColor : undefined }]}
                onPress={() => setSelectedTheme(theme.key)}
              >
                <Text style={styles.styleOptionEmoji}>{theme.emoji}</Text>
                <View style={styles.themePreviewBlock}>
                  <Text style={[styles.styleOptionLabel, selectedTheme === theme.key && styles.styleOptionLabelActive, { color: theme.textColor }]}>
                    {theme.label}
                  </Text>
                  <View style={[styles.themeColorDot, { backgroundColor: theme.bgColor, borderColor: theme.textColor }]} />
                </View>
                {selectedTheme === theme.key && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
            <View style={styles.modalActions}>
              <Button title="Cancel" onPress={() => setShowThemePicker(false)} variant="outline" size="md" />
              <Button title={isSavingTheme ? 'Saving...' : 'Save Theme'} onPress={handleSaveTheme} loading={isSavingTheme} size="md" />
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
  headerActions: { flexDirection: 'row', gap: spacing.xs },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },

  // Book header
  bookHeader: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  bookTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  bookMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' },
  bookMetaText: { fontSize: 12, color: colors.textMuted },
  headerButtons: { flexDirection: 'row', gap: spacing.xs },
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

  // Layout badge
  layoutBadgeRow: { alignItems: 'center', paddingVertical: 4 },
  layoutBadge: {
    backgroundColor: '#EEF2FF', borderRadius: borderRadius.full,
    paddingHorizontal: 12, paddingVertical: 4,
  },
  layoutBadgeText: { fontSize: 11, color: colors.primary, fontWeight: '600' },

  // Spread
  spreadContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  spread: {
    width: '100%', maxWidth: 700, flex: 1,
    borderRadius: borderRadius.lg, overflow: 'hidden', ...shadows.md,
  },

  // Page controls
  pageControls: {
    flexDirection: 'row', justifyContent: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, flexWrap: 'wrap',
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
  navActionRow: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center' },
  navActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: borderRadius.full, paddingHorizontal: spacing.md, paddingVertical: 7, ...shadows.sm,
  },
  navActionBtnLayout: { backgroundColor: colors.secondary },
  navActionBtnCover: { backgroundColor: colors.purple },  // purple for cover
  navActionBtnText: { fontSize: 12, color: colors.white, fontWeight: '700' },
  illustrateBookBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.primary, borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md, paddingVertical: 7, ...shadows.sm,
  },
  illustrateBookBtnDisabled: { backgroundColor: colors.gray200 },
  illustrateBookText: { fontSize: 12, color: colors.white, fontWeight: '700' },

  // Footer
  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, alignItems: 'center' },
  footerHook: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic', textAlign: 'center' },

  // Style/Theme picker modal
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
  themePreviewBlock: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  themeColorDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1 },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg, justifyContent: 'flex-end' },

  // Fullscreen image
  fullscreenOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  fullscreenImage: { width: SCREEN_W, height: SCREEN_W },
  fullscreenClose: { position: 'absolute', top: 48, right: 20 },
});
