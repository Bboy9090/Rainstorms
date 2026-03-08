import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../src/utils/theme';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Loading } from '../src/components/Loading';
import { SaveIndicator } from '../src/components/SaveIndicator';
import { useProject } from '../src/context/ProjectContext';
import { api, BASE_URL } from '../src/utils/api';

const { width } = Dimensions.get('window');

const IMPROVE_MODIFIERS = [
  { id: 'funnier', label: 'Make funnier', icon: 'happy-outline', color: '#FBBF24' },
  { id: 'cozier', label: 'Make cozier', icon: 'heart-outline', color: '#F472B6' },
  { id: 'dialogue', label: 'Add dialogue', icon: 'chatbubbles-outline', color: '#6366F1' },
  { id: 'simpler', label: 'Simplify', icon: 'leaf-outline', color: '#10B981' },
  { id: 'emotional', label: 'More emotional', icon: 'water-outline', color: '#3B82F6' },
];

export default function PageBuilderScreen() {
  const router = useRouter();
  const { 
    currentProject, 
    pages, 
    updatePage,
    saveStatus,
    lastSaved,
    isLoading, 
    setError 
  } = useProject();
  
  const [activePage, setActivePage] = useState(0);
  const [isGeneratingText, setIsGeneratingText] = useState(false);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [isGeneratingIllustration, setIsGeneratingIllustration] = useState(false);
  const [isImproving, setIsImproving] = useState<string | null>(null);
  const [showImprovePanel, setShowImprovePanel] = useState(false);

  if (isLoading || !currentProject) {
    return <Loading message="Loading pages..." fullScreen />;
  }

  const currentPageData = pages[activePage];

  const handleGeneratePageText = async () => {
    if (!currentPageData) return;
    setIsGeneratingText(true);
    try {
      const response = await api.post('/generate/page-text', {
        project_id: currentProject.id,
        page_number: currentPageData.page_number,
        outline_beat: currentPageData.outline_beat,
      });

      updatePage(currentPageData.id, {
        page_text: response.data.page_text,
        emotional_beat: response.data.emotional_beat,
      });
    } catch (err: any) {
      setError('Failed to generate page text');
    } finally {
      setIsGeneratingText(false);
    }
  };

  const handleGenerateIllustrationPrompt = async () => {
    if (!currentPageData || !currentPageData.page_text) return;
    setIsGeneratingPrompt(true);
    try {
      const response = await api.post('/generate/illustration-prompt', {
        project_id: currentProject.id,
        page_number: currentPageData.page_number,
        page_text: currentPageData.page_text,
      });

      updatePage(currentPageData.id, {
        illustration_prompt: response.data.illustration_prompt,
      });
    } catch (err: any) {
      setError('Failed to generate illustration prompt');
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const handleGenerateIllustration = async () => {
    if (!currentPageData) return;
    if (!currentPageData.illustration_prompt) {
      Alert.alert('No Prompt', 'Generate an illustration prompt first.');
      return;
    }
    setIsGeneratingIllustration(true);
    try {
      const response = await api.post(
        `/projects/${currentProject.id}/pages/${currentPageData.id}/illustrations/generate`
      );
      updatePage(currentPageData.id, { illustration_url: response.data.illustration_url });
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to generate illustration.';
      Alert.alert('Generation Failed', msg);
    } finally {
      setIsGeneratingIllustration(false);
    }
  };

  const handleImproveText = async (modifier: string) => {
    if (!currentPageData || !currentPageData.page_text) return;
    setIsImproving(modifier);
    try {
      const response = await api.post('/generate/improve-page', {
        project_id: currentProject.id,
        page_id: currentPageData.id,
        page_text: currentPageData.page_text,
        modifier,
      });

      updatePage(currentPageData.id, {
        page_text: response.data.page_text,
      });
      setShowImprovePanel(false);
    } catch (err: any) {
      setError('Failed to improve page text');
    } finally {
      setIsImproving(null);
    }
  };

  const handleTextChange = (text: string) => {
    if (currentPageData) {
      updatePage(currentPageData.id, { page_text: text });
    }
  };

  const handlePromptChange = (text: string) => {
    if (currentPageData) {
      updatePage(currentPageData.id, { illustration_prompt: text });
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerTitle}>
            <Ionicons name="book" size={24} color={colors.primary} />
            <Text style={styles.title}>Page Builder</Text>
          </View>
          <SaveIndicator status={saveStatus} lastSaved={lastSaved} />
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push('/storybook-preview')}
          >
            <Ionicons name="albums-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push('/export')}
          >
            <Ionicons name="download-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Page Navigation */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pageNav}
        contentContainerStyle={styles.pageNavContent}
      >
        {pages.map((page, index) => (
          <TouchableOpacity
            key={page.id}
            style={[
              styles.pageTab,
              index === activePage && styles.pageTabActive,
            ]}
            onPress={() => setActivePage(index)}
          >
            <Text
              style={[
                styles.pageTabText,
                index === activePage && styles.pageTabTextActive,
              ]}
            >
              {page.page_number}
            </Text>
            {(page.page_text || page.illustration_prompt) && (
              <View style={styles.pageIndicator}>
                <Ionicons
                  name={page.illustration_url ? 'image' : page.page_text && page.illustration_prompt ? 'checkmark-circle' : 'ellipse'}
                  size={12}
                  color={page.illustration_url ? colors.primary : page.page_text && page.illustration_prompt ? colors.success : colors.warning}
                />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Page Content */}
      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.content}>
        {currentPageData && (
          <>
            {/* Outline Beat */}
            <Card style={styles.outlineCard} variant="outlined">
              <View style={styles.cardHeader}>
                <Ionicons name="map-outline" size={18} color={colors.primary} />
                <Text style={styles.cardLabel}>Story Beat</Text>
              </View>
              <Text style={styles.outlineText}>{currentPageData.outline_beat}</Text>
            </Card>

            {/* Page Text */}
            <Card style={styles.textCard} variant="elevated">
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeader}>
                  <Ionicons name="document-text" size={18} color={colors.primary} />
                  <Text style={styles.cardLabel}>Page Text</Text>
                </View>
                <View style={styles.buttonGroup}>
                  {currentPageData.page_text && (
                    <TouchableOpacity
                      style={styles.improveToggle}
                      onPress={() => setShowImprovePanel(!showImprovePanel)}
                    >
                      <Ionicons name="sparkles" size={16} color={colors.accent} />
                      <Text style={styles.improveToggleText}>Improve</Text>
                    </TouchableOpacity>
                  )}
                  <Button
                    title={currentPageData.page_text ? 'Regenerate' : 'Generate'}
                    onPress={handleGeneratePageText}
                    variant="outline"
                    size="sm"
                    loading={isGeneratingText}
                    icon={<Ionicons name="refresh" size={14} color={colors.primary} />}
                  />
                </View>
              </View>

              {/* Improve This Page Panel */}
              {showImprovePanel && currentPageData.page_text && (
                <View style={styles.improvePanel}>
                  <Text style={styles.improvePanelTitle}>Improve this page:</Text>
                  <View style={styles.improveButtons}>
                    {IMPROVE_MODIFIERS.map((mod) => (
                      <TouchableOpacity
                        key={mod.id}
                        style={[
                          styles.improveButton,
                          { borderColor: mod.color },
                          isImproving === mod.id && styles.improveButtonActive,
                        ]}
                        onPress={() => handleImproveText(mod.id)}
                        disabled={!!isImproving}
                      >
                        <Ionicons 
                          name={mod.icon as any} 
                          size={16} 
                          color={isImproving === mod.id ? colors.white : mod.color} 
                        />
                        <Text style={[
                          styles.improveButtonText,
                          { color: isImproving === mod.id ? colors.white : mod.color }
                        ]}>
                          {isImproving === mod.id ? 'Improving...' : mod.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <TextInput
                style={styles.textInput}
                value={currentPageData.page_text}
                onChangeText={handleTextChange}
                multiline
                placeholder="Click 'Generate' to create page text, or write your own..."
                placeholderTextColor={colors.gray400}
              />
              {currentPageData.emotional_beat && (
                <View style={styles.emotionalBeat}>
                  <Ionicons name="heart" size={14} color={colors.secondary} />
                  <Text style={styles.emotionalBeatText}>
                    Emotional beat: {currentPageData.emotional_beat}
                  </Text>
                </View>
              )}
            </Card>

            {/* Illustration Prompt */}
            <Card style={styles.promptCard} variant="elevated">
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeader}>
                  <Ionicons name="brush" size={18} color={colors.accent} />
                  <Text style={styles.cardLabel}>Illustration Prompt</Text>
                </View>
                <Button
                  title={currentPageData.illustration_prompt ? 'Regenerate' : 'Generate'}
                  onPress={handleGenerateIllustrationPrompt}
                  variant="outline"
                  size="sm"
                  loading={isGeneratingPrompt}
                  disabled={!currentPageData.page_text}
                  icon={<Ionicons name="color-palette" size={14} color={colors.primary} />}
                />
              </View>
              {currentPageData.illustration_prompt ? (
                <TextInput
                  style={styles.promptInput}
                  value={currentPageData.illustration_prompt}
                  onChangeText={handlePromptChange}
                  multiline
                  placeholder="Illustration prompt..."
                  placeholderTextColor={colors.gray400}
                />
              ) : (
                <Text style={styles.promptPlaceholder}>
                  Generate page text first, then create an illustration prompt.
                </Text>
              )}
            </Card>

            {/* Illustration Preview */}
            {currentPageData.illustration_prompt && (
              <Card style={styles.illustrationCard} variant="elevated">
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="image" size={18} color={colors.primary} />
                    <Text style={styles.cardLabel}>Illustration</Text>
                  </View>
                  <Button
                    title={isGeneratingIllustration ? 'Generating…' : currentPageData.illustration_url ? 'Regenerate' : 'Generate Image'}
                    onPress={handleGenerateIllustration}
                    variant={currentPageData.illustration_url ? 'outline' : 'primary'}
                    size="sm"
                    loading={isGeneratingIllustration}
                    icon={<Ionicons name="sparkles" size={14} color={currentPageData.illustration_url ? colors.primary : colors.white} />}
                  />
                </View>
                {isGeneratingIllustration ? (
                  <View style={styles.illustrationGenerating}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.generatingText}>Generating illustration…</Text>
                  </View>
                ) : currentPageData.illustration_url ? (
                  <Image
                    source={{ uri: `${BASE_URL}${currentPageData.illustration_url}`.replace(/(?<!:)\/\//g, '/') }}
                    style={styles.illustrationPreviewImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.illustrationEmptyState}>
                    <Ionicons name="images-outline" size={32} color={colors.gray300} />
                    <Text style={styles.illustrationEmptyText}>
                      Tap "Generate Image" to create the illustration
                    </Text>
                  </View>
                )}
              </Card>
            )}
          </>
        )}
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.navButton, activePage === 0 && styles.navButtonDisabled]}
          onPress={() => setActivePage(Math.max(0, activePage - 1))}
          disabled={activePage === 0}
        >
          <Ionicons
            name="chevron-back"
            size={20}
            color={activePage === 0 ? colors.gray300 : colors.textPrimary}
          />
          <Text style={[styles.navButtonText, activePage === 0 && styles.navButtonTextDisabled]}>
            Previous
          </Text>
        </TouchableOpacity>

        <Text style={styles.pageIndicatorText}>
          Page {activePage + 1} of {pages.length}
        </Text>

        <TouchableOpacity
          style={[styles.navButton, activePage === pages.length - 1 && styles.navButtonDisabled]}
          onPress={() => setActivePage(Math.min(pages.length - 1, activePage + 1))}
          disabled={activePage === pages.length - 1}
        >
          <Text
            style={[
              styles.navButtonText,
              activePage === pages.length - 1 && styles.navButtonTextDisabled,
            ]}
          >
            Next
          </Text>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={activePage === pages.length - 1 ? colors.gray300 : colors.textPrimary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgStart,
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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  pageNav: {
    maxHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  pageNavContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  pageTab: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  pageTabActive: {
    backgroundColor: colors.primary,
  },
  pageTabText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  pageTabTextActive: {
    color: colors.white,
  },
  pageIndicator: {
    position: 'absolute',
    top: -4,
    right: -4,
  },
  contentScroll: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  outlineCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  buttonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  improveToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#FEF3C7',
    borderRadius: borderRadius.full,
  },
  improveToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
  improvePanel: {
    backgroundColor: colors.gray100,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  improvePanelTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  improveButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  improveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    backgroundColor: colors.white,
  },
  improveButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  improveButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  outlineText: {
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 22,
    marginTop: spacing.sm,
  },
  textCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  textInput: {
    fontSize: 16,
    color: colors.textPrimary,
    lineHeight: 26,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  emotionalBeat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  emotionalBeatText: {
    fontSize: 14,
    color: colors.secondary,
    fontStyle: 'italic',
  },
  promptCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  promptInput: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  promptPlaceholder: {
    fontSize: 14,
    color: colors.gray400,
    fontStyle: 'italic',
  },
  // Illustration card styles
  illustrationCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  illustrationGenerating: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  generatingText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  illustrationPreviewImage: {
    width: '100%',
    height: 240,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  illustrationEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  illustrationEmptyText: {
    fontSize: 13,
    color: colors.gray400,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  navButtonTextDisabled: {
    color: colors.gray300,
  },
  pageIndicatorText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});
