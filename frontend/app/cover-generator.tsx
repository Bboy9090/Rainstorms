import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Modal,
  Alert,
  Platform,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { colors, spacing, borderRadius, shadows } from '../src/utils/theme';
import { Button } from '../src/components/Button';
import { Loading } from '../src/components/Loading';
import { useProject, CoverData } from '../src/context/ProjectContext';
import { api, buildImageUrl, getImageFileExtension } from '../src/utils/api';

const { width: SCREEN_W } = Dimensions.get('window');
const COVER_PREVIEW_W = Math.min(SCREEN_W - 48, 340);
const COVER_PREVIEW_H = Math.round(COVER_PREVIEW_W * 1.33); // ~3:4 aspect ratio

const COVER_STYLES = [
  { key: 'cozy_bedtime',     label: 'Cozy Bedtime',     emoji: '🌙', description: 'Soft lighting, stars and warmth' },
  { key: 'adventure',        label: 'Adventure',         emoji: '⚡', description: 'Bold colors, action composition' },
  { key: 'character_closeup',label: 'Character Close-Up',emoji: '👤', description: 'Character portrait, expressive face' },
  { key: 'scene',            label: 'Scene Cover',       emoji: '🏡', description: 'Important story moment, full scene' },
  { key: 'sketch_cartoony',  label: 'Color Sketch Cartoony', emoji: '🖍️', description: 'Playful hand-drawn sketch, vibrant colors' },
];

export default function CoverGeneratorScreen() {
  const router = useRouter();
  const { currentProject, isLoading, updateProject } = useProject();

  const [isGenerating, setIsGenerating] = useState(false);
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [coverData, setCoverData] = useState<CoverData | null>(
    currentProject?.cover ?? null
  );
  const [selectedStyle, setSelectedStyle] = useState<string>(
    currentProject?.cover?.cover_style ?? 'sketch_cartoony'
  );
  const [authorName, setAuthorName] = useState<string>(
    currentProject?.cover?.author_name ?? ''
  );
  const [tagline, setTagline] = useState<string>(
    currentProject?.cover?.tagline ?? ''
  );
  const [isSavingMeta, setIsSavingMeta] = useState(false);

  // Keep local state in sync when project updates
  useEffect(() => {
    if (currentProject?.cover) {
      setCoverData(currentProject.cover);
      setSelectedStyle(currentProject.cover.cover_style ?? 'sketch_cartoony');
      setAuthorName(currentProject.cover.author_name ?? '');
      setTagline(currentProject.cover.tagline ?? '');
    }
  }, [currentProject?.cover]);

  if (isLoading || !currentProject) {
    return <Loading message="Loading cover generator..." fullScreen />;
  }

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    try {
      const res = await api.post(`/projects/${currentProject.id}/cover/generate`, {
        cover_style: selectedStyle,
        author_name: authorName || undefined,
        tagline: tagline || undefined,
      });
      const newCover: CoverData = res.data.cover;
      setCoverData(newCover);
      updateProject({ cover: newCover });
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Cover generation failed.';
      Alert.alert('Generation Failed', msg);
    } finally {
      setIsGenerating(false);
    }
  }, [currentProject, selectedStyle, authorName, tagline, updateProject]);

  const handleSaveMeta = useCallback(async () => {
    setIsSavingMeta(true);
    try {
      const res = await api.put(`/projects/${currentProject.id}/cover`, {
        cover_style: selectedStyle,
        author_name: authorName,
        tagline: tagline,
      });
      const updated: CoverData = res.data.cover;
      setCoverData(updated);
      updateProject({ cover: updated });
    } catch {
      Alert.alert('Error', 'Failed to save cover settings.');
    } finally {
      setIsSavingMeta(false);
    }
  }, [currentProject, selectedStyle, authorName, tagline, updateProject]);

  const handleDownload = useCallback(async () => {
    if (!coverData?.front_cover_url) return;
    const url = buildImageUrl(coverData.front_cover_url);
    if (!url) return;
    if (Platform.OS === 'web') {
      const a = document.createElement('a');
      a.href = url;
      a.download = `front_cover.${getImageFileExtension(url)}`;
      a.click();
    } else {
      await Linking.openURL(url);
    }
  }, [coverData]);

  const activeStyleInfo = COVER_STYLES.find((s) => s.key === selectedStyle) ?? COVER_STYLES[0];
  const rawCoverUrl = coverData?.front_cover_url ?? '';
  const coverImageUrl = rawCoverUrl ? buildImageUrl(rawCoverUrl) : '';
  const coverImageLost = !!rawCoverUrl && !coverImageUrl;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Ionicons name="book" size={24} color={colors.primary} />
          <Text style={styles.title}>Cover Generator</Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      {/* ── Book title ── */}
      <Text style={styles.bookTitle} numberOfLines={2}>{currentProject.title}</Text>
      <Text style={styles.bookSubtitle}>Ages {currentProject.age_range} • {currentProject.page_count} pages</Text>

      {/* ── Cover Preview ── */}
      <View style={styles.coverPreviewContainer}>
        {isGenerating ? (
          <View style={[styles.coverPreviewPlaceholder, { width: COVER_PREVIEW_W, height: COVER_PREVIEW_H }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.generatingText}>Generating cover…</Text>
            <Text style={styles.generatingSubtext}>This takes about 15–30 seconds</Text>
          </View>
        ) : coverImageUrl ? (
          <View style={[styles.coverPreviewCard, { width: COVER_PREVIEW_W, height: COVER_PREVIEW_H }]}>
            <Image
              source={{ uri: coverImageUrl }}
              style={styles.coverImage}
              resizeMode="cover"
            />
            {/* Title overlay */}
            <View style={styles.titleOverlay}>
              <Text style={styles.coverTitleText} numberOfLines={3}>{currentProject.title}</Text>
              {tagline ? <Text style={styles.coverTagline} numberOfLines={2}>{tagline}</Text> : null}
              {authorName ? <Text style={styles.coverAuthor}>by {authorName}</Text> : null}
            </View>
          </View>
        ) : (
          <View style={[styles.coverPreviewPlaceholder, { width: COVER_PREVIEW_W, height: COVER_PREVIEW_H }]}>
            <Ionicons name="book-outline" size={56} color={colors.gray300} />
            {coverImageLost ? (
              <>
                <Text style={styles.placeholderTitle}>Cover Was Lost</Text>
                <Text style={styles.placeholderSub}>Tap "Regenerate Cover" below to recreate it</Text>
              </>
            ) : (
              <>
                <Text style={styles.placeholderTitle}>No Cover Yet</Text>
                <Text style={styles.placeholderSub}>Configure settings below and tap Generate Cover</Text>
              </>
            )}
          </View>
        )}
      </View>

      {/* ── Primary action button ── */}
      <View style={styles.primaryActionRow}>
        <Button
          title={isGenerating ? 'Generating…' : rawCoverUrl ? 'Regenerate Cover' : 'Generate Cover'}
          onPress={handleGenerate}
          loading={isGenerating}
          disabled={isGenerating}
          size="lg"
        />
        {coverImageUrl && !coverImageLost && (
          <TouchableOpacity style={styles.downloadBtn} onPress={handleDownload}>
            <Ionicons name="download-outline" size={20} color={colors.primary} />
            <Text style={styles.downloadBtnText}>Download</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Cover Style ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cover Style</Text>
        <TouchableOpacity style={styles.styleSelector} onPress={() => setShowStylePicker(true)}>
          <Text style={styles.styleSelectorEmoji}>{activeStyleInfo.emoji}</Text>
          <View style={styles.styleSelectorText}>
            <Text style={styles.styleSelectorLabel}>{activeStyleInfo.label}</Text>
            <Text style={styles.styleSelectorDesc}>{activeStyleInfo.description}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
        </TouchableOpacity>
      </View>

      {/* ── Metadata fields ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cover Text</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Author Name</Text>
          <TextInput
            style={styles.fieldInput}
            value={authorName}
            onChangeText={setAuthorName}
            placeholder="Your name or pen name"
            placeholderTextColor={colors.gray400}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Tagline (optional)</Text>
          <TextInput
            style={styles.fieldInput}
            value={tagline}
            onChangeText={setTagline}
            placeholder="e.g. A brave hero. A big dream."
            placeholderTextColor={colors.gray400}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveMetaBtn, isSavingMeta && styles.saveMetaBtnDisabled]}
          onPress={handleSaveMeta}
          disabled={isSavingMeta}
        >
          {isSavingMeta ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Ionicons name="checkmark" size={16} color={colors.white} />
          )}
          <Text style={styles.saveMetaBtnText}>{isSavingMeta ? 'Saving…' : 'Save Cover Text'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Concept + Back blurb ── */}
      {coverData?.concept ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cover Concept</Text>
          <View style={styles.conceptBox}>
            <Text style={styles.conceptText}>{coverData.concept}</Text>
          </View>
        </View>
      ) : null}

      {coverData?.back_blurb ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Back Cover Blurb</Text>
          <View style={styles.blurbBox}>
            <Text style={styles.blurbText}>{coverData.back_blurb}</Text>
          </View>
        </View>
      ) : null}

      {/* ── Cover Style Picker Modal ── */}
      <Modal visible={showStylePicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cover Style</Text>
            <Text style={styles.modalSubtitle}>Choose the visual style for your cover illustration.</Text>
            {COVER_STYLES.map((style) => (
              <TouchableOpacity
                key={style.key}
                style={[styles.styleOption, selectedStyle === style.key && styles.styleOptionActive]}
                onPress={() => {
                  setSelectedStyle(style.key);
                  setShowStylePicker(false);
                }}
              >
                <Text style={styles.styleOptionEmoji}>{style.emoji}</Text>
                <View style={styles.styleOptionText}>
                  <Text style={[styles.styleOptionLabel, selectedStyle === style.key && styles.styleOptionLabelActive]}>
                    {style.label}
                  </Text>
                  <Text style={styles.styleOptionDesc}>{style.description}</Text>
                </View>
                {selectedStyle === style.key && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
            <Button title="Close" onPress={() => setShowStylePicker(false)} variant="outline" size="md" />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  content: { paddingBottom: spacing.xxl },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md,
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: borderRadius.full,
    backgroundColor: colors.cardBg, alignItems: 'center', justifyContent: 'center',
    ...shadows.sm,
  },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },

  bookTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', paddingHorizontal: spacing.xl },
  bookSubtitle: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 2, marginBottom: spacing.lg },

  // Cover preview
  coverPreviewContainer: { alignItems: 'center', marginBottom: spacing.lg },
  coverPreviewPlaceholder: {
    backgroundColor: colors.tintPrimary, borderRadius: borderRadius.lg,
    alignItems: 'center', justifyContent: 'center',
    ...shadows.md, padding: spacing.xl,
  },
  coverPreviewCard: { borderRadius: borderRadius.lg, overflow: 'hidden', ...shadows.lg, position: 'relative' },
  coverImage: { width: '100%', height: '100%' },
  titleOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)', padding: spacing.md, paddingBottom: spacing.lg,
  },
  coverTitleText: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', lineHeight: 24 },
  coverTagline: { fontSize: 12, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 4, fontStyle: 'italic' },
  coverAuthor: { fontSize: 11, color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginTop: 6 },
  generatingText: { fontSize: 15, fontWeight: '600', color: colors.primary, marginTop: spacing.md },
  generatingSubtext: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  placeholderTitle: { fontSize: 16, fontWeight: '700', color: colors.gray400, marginTop: spacing.md },
  placeholderSub: { fontSize: 12, color: colors.gray400, marginTop: 4, textAlign: 'center' },

  // Primary action
  primaryActionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.lg,
  },
  downloadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    backgroundColor: colors.cardBg, borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: colors.primary, ...shadows.sm,
  },
  downloadBtnText: { fontSize: 13, color: colors.primary, fontWeight: '600' },

  // Section
  section: { marginHorizontal: spacing.lg, marginBottom: spacing.lg },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Style selector
  styleSelector: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.cardBg, borderRadius: borderRadius.md,
    padding: spacing.md, ...shadows.sm,
    borderWidth: 1, borderColor: colors.gray200,
  },
  styleSelectorEmoji: { fontSize: 28 },
  styleSelectorText: { flex: 1 },
  styleSelectorLabel: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  styleSelectorDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  // Field group
  fieldGroup: { marginBottom: spacing.md },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  fieldInput: {
    backgroundColor: colors.cardBg, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.gray200,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    fontSize: 15, color: colors.textPrimary, ...shadows.sm,
  },

  // Save meta
  saveMetaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    backgroundColor: colors.secondary, borderRadius: borderRadius.md,
    paddingVertical: 10, ...shadows.sm, marginTop: spacing.xs,
  },
  saveMetaBtnDisabled: { opacity: 0.5 },
  saveMetaBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },

  // Concept + blurb
  conceptBox: {
    backgroundColor: colors.tintPrimary, borderRadius: borderRadius.md,
    padding: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.primary,
  },
  conceptText: { fontSize: 13, color: colors.textSecondary, lineHeight: 20, fontStyle: 'italic' },
  blurbBox: {
    backgroundColor: '#F0FDF4', borderRadius: borderRadius.md,
    padding: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.success,
  },
  blurbText: { fontSize: 14, color: colors.textPrimary, lineHeight: 22 },

  // Style picker modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.sm,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.xs },
  modalSubtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm },
  styleOption: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.gray200,
  },
  styleOptionActive: { borderColor: colors.primary, backgroundColor: colors.tintPrimary },
  styleOptionEmoji: { fontSize: 24 },
  styleOptionText: { flex: 1 },
  styleOptionLabel: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  styleOptionLabelActive: { color: colors.primary, fontWeight: '700' },
  styleOptionDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
