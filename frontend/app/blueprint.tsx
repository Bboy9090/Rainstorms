import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../src/utils/theme';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Loading } from '../src/components/Loading';
import { useProject } from '../src/context/ProjectContext';
import { api, formatApiError } from '../src/utils/api';

export default function BlueprintScreen() {
  const router = useRouter();
  const { currentProject, setCurrentProject, pages, setPages, isLoading, setIsLoading, setError, error } = useProject();
  
  const [isRegeneratingTitle, setIsRegeneratingTitle] = useState(false);
  const [isRegeneratingOutline, setIsRegeneratingOutline] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');

  if (isLoading || !currentProject) {
    return <Loading message="Loading blueprint..." fullScreen />;
  }

  const handleRegenerateTitle = async () => {
    setIsRegeneratingTitle(true);
    try {
      const response = await api.post(`/generate/title?project_id=${currentProject.id}`);
      setCurrentProject({ ...currentProject, title: response.data.title });
    } catch (err: any) {
      setError(formatApiError(err, 'Failed to regenerate title'));
    } finally {
      setIsRegeneratingTitle(false);
    }
  };

  const handleRegenerateOutline = async () => {
    setIsRegeneratingOutline(true);
    try {
      const blueprintRes = await api.post('/generate/blueprint', {
        original_idea: currentProject.original_idea,
        tone: currentProject.tone,
        age_range: currentProject.age_range,
        page_count: currentProject.page_count,
      });

      const blueprint = blueprintRes.data;

      // Update project
      await api.put(`/projects/${currentProject.id}`, {
        outline: blueprint.outline,
      });

      // Recreate pages from new outline
      const pagesData = blueprint.outline.map((beat: string, index: number) => ({
        page_number: index + 1,
        outline_beat: beat,
        page_text: '',
        illustration_prompt: '',
        emotional_beat: '',
      }));

      await api.post(`/projects/${currentProject.id}/pages/bulk`, pagesData);

      // Reload pages
      const pagesRes = await api.get(`/projects/${currentProject.id}/pages`);
      setPages(pagesRes.data);
      setCurrentProject({ ...currentProject, outline: blueprint.outline });
    } catch (err: any) {
      setError(formatApiError(err, 'Failed to regenerate outline'));
    } finally {
      setIsRegeneratingOutline(false);
    }
  };

  const handleEditTitle = () => {
    setTempTitle(currentProject.title);
    setEditingTitle(true);
  };

  const handleSaveTitle = async () => {
    if (tempTitle.trim() && tempTitle !== currentProject.title) {
      await api.put(`/projects/${currentProject.id}`, { title: tempTitle.trim() });
      setCurrentProject({ ...currentProject, title: tempTitle.trim() });
    }
    setEditingTitle(false);
  };

  const handleAcceptBlueprint = () => {
    router.push('/characters');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Ionicons name="document-text" size={28} color={colors.primary} />
          <Text style={styles.title}>Story Blueprint</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {error && (
        <Card style={styles.errorCard} variant="outlined">
          <View style={styles.errorRow}>
            <Ionicons name="warning" size={18} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        </Card>
      )}

      {/* Title Section */}
      <Card style={styles.titleCard} variant="elevated">
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Title</Text>
          <View style={styles.sectionActions}>
            <TouchableOpacity style={styles.iconButton} onPress={handleEditTitle}>
              <Ionicons name="pencil" size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleRegenerateTitle}
              disabled={isRegeneratingTitle}
            >
              <Ionicons
                name={isRegeneratingTitle ? 'sync' : 'refresh'}
                size={18}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>
        </View>
        {editingTitle ? (
          <View style={styles.editTitleContainer}>
            <TextInput
              style={styles.titleInput}
              value={tempTitle}
              onChangeText={setTempTitle}
              autoFocus
            />
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveTitle}>
              <Ionicons name="checkmark" size={20} color={colors.white} />
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.bookTitle}>{currentProject.title}</Text>
        )}
      </Card>

      {/* Hook & Summary */}
      <Card style={styles.card}>
        <Text style={styles.sectionLabel}>One-Line Hook</Text>
        <Text style={styles.hookText}>{currentProject.hook}</Text>

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>Summary</Text>
        <Text style={styles.bodyText}>{currentProject.summary}</Text>

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>Theme</Text>
        <Text style={styles.bodyText}>{currentProject.theme}</Text>
      </Card>

      {/* Meta Info */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="person" size={18} color={colors.primary} />
          <Text style={styles.metaText}>Ages {currentProject.age_range}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="book" size={18} color={colors.secondary} />
          <Text style={styles.metaText}>{currentProject.page_count} Pages</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="heart" size={18} color={colors.accent} />
          <Text style={styles.metaText}>{currentProject.tone}</Text>
        </View>
      </View>

      {/* Outline */}
      <Card style={styles.outlineCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.outlineTitle}>Page-by-Page Outline</Text>
          <TouchableOpacity
            style={styles.regenerateButton}
            onPress={handleRegenerateOutline}
            disabled={isRegeneratingOutline}
          >
            <Ionicons
              name={isRegeneratingOutline ? 'sync' : 'refresh'}
              size={16}
              color={colors.primary}
            />
            <Text style={styles.regenerateText}>Regenerate</Text>
          </TouchableOpacity>
        </View>

        {isRegeneratingOutline ? (
          <Loading message="Regenerating outline..." />
        ) : (
          <View style={styles.outlineList}>
            {pages.length > 0 ? pages.map((page, index) => (
              <View key={page.id} style={styles.outlineItem}>
                <View style={styles.pageNumber}>
                  <Text style={styles.pageNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.outlineBeat}>{page.outline_beat}</Text>
              </View>
            )) : currentProject.outline?.map((beat, index) => (
              <View key={index} style={styles.outlineItem}>
                <View style={styles.pageNumber}>
                  <Text style={styles.pageNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.outlineBeat}>{beat}</Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title="Accept Blueprint"
          onPress={handleAcceptBlueprint}
          size="lg"
          icon={<Ionicons name="checkmark-circle" size={22} color={colors.white} />}
          style={styles.acceptButton}
        />
        <Button
          title="Back to Edit Inputs"
          onPress={() => router.back()}
          variant="outline"
          size="md"
        />
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
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.cardBg,
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
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  titleCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  card: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  sectionActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    lineHeight: 36,
  },
  editTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  titleInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingVertical: spacing.xs,
  },
  saveButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hookText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary,
    fontStyle: 'italic',
    lineHeight: 26,
  },
  bodyText: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray200,
    marginVertical: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.cardBg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    ...shadows.sm,
  },
  metaText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  outlineCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  outlineTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  regenerateText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  outlineList: {
    gap: spacing.md,
  },
  outlineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  pageNumber: {
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
  outlineBeat: {
    flex: 1,
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  actions: {
    gap: spacing.md,
    alignItems: 'center',
  },
  acceptButton: {
    width: '100%',
    maxWidth: 320,
  },
  errorCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderColor: colors.error,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: colors.error,
    lineHeight: 20,
  },
});
