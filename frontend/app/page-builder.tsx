import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../src/utils/theme';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Loading } from '../src/components/Loading';
import { SaveIndicator } from '../src/components/SaveIndicator';
import { useProject } from '../src/context/ProjectContext';
import { api } from '../src/utils/api';

const { width } = Dimensions.get('window');

export default function PageBuilderScreen() {
  const router = useRouter();
  const { 
    currentProject, 
    pages, 
    setPages, 
    updatePage,
    saveStatus,
    lastSaved,
    isLoading, 
    setError 
  } = useProject();
  
  const [activePage, setActivePage] = useState(0);
  const [isGeneratingText, setIsGeneratingText] = useState(false);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);

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

      // Use updatePage for autosave
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

      // Use updatePage for autosave
      updatePage(currentPageData.id, {
        illustration_prompt: response.data.illustration_prompt,
      });
    } catch (err: any) {
      setError('Failed to generate illustration prompt');
    } finally {
      setIsGeneratingPrompt(false);
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
        <TouchableOpacity
          style={styles.exportButton}
          onPress={() => router.push('/export')}
        >
          <Ionicons name="download-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
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
                  name={page.page_text && page.illustration_prompt ? 'checkmark-circle' : 'ellipse'}
                  size={12}
                  color={page.page_text && page.illustration_prompt ? colors.success : colors.warning}
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
                <Button
                  title={currentPageData.page_text ? 'Regenerate' : 'Generate'}
                  onPress={handleGeneratePageText}
                  variant="outline"
                  size="sm"
                  loading={isGeneratingText}
                  icon={<Ionicons name="sparkles" size={14} color={colors.primary} />}
                />
              </View>
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
  exportButton: {
    width: 40,
    height: 40,
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
