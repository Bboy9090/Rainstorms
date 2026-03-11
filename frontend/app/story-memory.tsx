import React, { useEffect, useState } from 'react';
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
import { SaveIndicator } from '../src/components/SaveIndicator';
import { useProject } from '../src/context/ProjectContext';
import { api, formatApiError } from '../src/utils/api';

interface StoryMemoryData {
  characters: Array<{ name: string; key_traits: string; visual_key: string }>;
  relationships: Array<{ char1: string; char2: string; type: string }>;
  settings: Array<{ name: string; description: string }>;
  events: Array<{ description: string }>;
  tone_notes: string;
  style_guide: string;
}

export default function StoryMemoryScreen() {
  const router = useRouter();
  const { currentProject, characters, saveStatus, lastSaved, isLoading, setError } = useProject();
  const [memory, setMemory] = useState<StoryMemoryData | null>(null);
  const [isLoadingMemory, setIsLoadingMemory] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedToneNotes, setEditedToneNotes] = useState('');
  const [editedStyleGuide, setEditedStyleGuide] = useState('');

  useEffect(() => {
    if (currentProject) {
      loadMemory();
    }
  }, [currentProject?.id]);

  const loadMemory = async () => {
    if (!currentProject) return;
    setIsLoadingMemory(true);
    try {
      const response = await api.get(`/projects/${currentProject.id}/story-memory`);
      setMemory(response.data);
      setEditedToneNotes(response.data.tone_notes || '');
      setEditedStyleGuide(response.data.style_guide || '');
    } catch (err) {
      console.error('Failed to load story memory:', err);
    } finally {
      setIsLoadingMemory(false);
    }
  };

  const handleGenerate = async () => {
    if (!currentProject) return;
    setIsGenerating(true);
    try {
      const response = await api.post(`/projects/${currentProject.id}/story-memory/generate`);
      setMemory(response.data);
      setEditedToneNotes(response.data.tone_notes || '');
      setEditedStyleGuide(response.data.style_guide || '');
    } catch (err) {
      setError(formatApiError(err, 'Failed to generate story memory'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!currentProject) return;
    setIsSaving(true);
    try {
      await api.put(`/projects/${currentProject.id}/story-memory`, {
        tone_notes: editedToneNotes,
        style_guide: editedStyleGuide,
      });
    } catch (err) {
      setError(formatApiError(err, 'Failed to save story memory'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !currentProject) {
    return <Loading message="Loading..." fullScreen />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerTitle}>
            <Ionicons name="brain" size={24} color={colors.primary} />
            <Text style={styles.title}>Story Memory</Text>
          </View>
          <SaveIndicator status={saveStatus} lastSaved={lastSaved} />
        </View>
        <View style={{ width: 40 }} />
      </View>

      <Text style={styles.subtitle}>
        Keep your story consistent. This memory is used in all AI generation.
      </Text>

      {/* Generate Button */}
      <View style={styles.actionBar}>
        <Button
          title={memory?.characters?.length ? 'Refresh Memory' : 'Generate Memory'}
          onPress={handleGenerate}
          loading={isGenerating}
          icon={<Ionicons name="sparkles" size={18} color={colors.white} />}
        />
      </View>

      {isLoadingMemory ? (
        <Loading message="Loading story memory..." />
      ) : (
        <>
          {/* Characters Summary */}
          <Card style={styles.section} variant="elevated">
            <View style={styles.sectionHeader}>
              <Ionicons name="people" size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>Characters</Text>
            </View>
            {memory?.characters && memory.characters.length > 0 ? (
              <View style={styles.charList}>
                {memory.characters.map((char, idx) => (
                  <View key={idx} style={styles.charItem}>
                    <Text style={styles.charName}>{char.name}</Text>
                    <Text style={styles.charTraits}>{char.key_traits}</Text>
                    {char.visual_key && (
                      <Text style={styles.charVisual}>{char.visual_key}</Text>
                    )}
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>
                No characters in memory. Generate or add them on the Character Forge screen.
              </Text>
            )}
          </Card>

          {/* Settings */}
          <Card style={styles.section} variant="elevated">
            <View style={styles.sectionHeader}>
              <Ionicons name="location" size={20} color={colors.accent} />
              <Text style={styles.sectionTitle}>Settings & Locations</Text>
            </View>
            {memory?.settings && memory.settings.length > 0 ? (
              <View style={styles.settingsList}>
                {memory.settings.map((setting, idx) => (
                  <View key={idx} style={styles.settingItem}>
                    <Text style={styles.settingName}>{setting.name}</Text>
                    <Text style={styles.settingDesc}>{setting.description}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>
                No settings recorded yet.
              </Text>
            )}
          </Card>

          {/* Tone Notes */}
          <Card style={styles.section} variant="elevated">
            <View style={styles.sectionHeader}>
              <Ionicons name="musical-notes" size={20} color={colors.secondary} />
              <Text style={styles.sectionTitle}>Tone Notes</Text>
            </View>
            <TextInput
              style={styles.textInput}
              value={editedToneNotes}
              onChangeText={setEditedToneNotes}
              placeholder="Describe the tone and mood of your story..."
              placeholderTextColor={colors.gray400}
              multiline
            />
          </Card>

          {/* Style Guide */}
          <Card style={styles.section} variant="elevated">
            <View style={styles.sectionHeader}>
              <Ionicons name="pencil" size={20} color={colors.info} />
              <Text style={styles.sectionTitle}>Writing Style Guide</Text>
            </View>
            <TextInput
              style={styles.textInput}
              value={editedStyleGuide}
              onChangeText={setEditedStyleGuide}
              placeholder="Guidelines for writing consistency..."
              placeholderTextColor={colors.gray400}
              multiline
            />
          </Card>

          {/* Save Button */}
          <View style={styles.saveContainer}>
            <Button
              title="Save Memory"
              onPress={handleSave}
              loading={isSaving}
              icon={<Ionicons name="save" size={18} color={colors.white} />}
            />
          </View>

          {/* Continue Button */}
          <View style={styles.continueContainer}>
            <Button
              title="Continue to Page Builder"
              onPress={() => router.push('/page-builder')}
              variant="outline"
              icon={<Ionicons name="arrow-forward" size={18} color={colors.primary} />}
            />
          </View>
        </>
      )}
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
    marginBottom: spacing.md,
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
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  actionBar: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  section: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  charList: {
    gap: spacing.md,
  },
  charItem: {
    backgroundColor: colors.gray100,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  charName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  charTraits: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  charVisual: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  settingsList: {
    gap: spacing.sm,
  },
  settingItem: {
    backgroundColor: colors.gray100,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  settingName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
    marginBottom: 2,
  },
  settingDesc: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  emptyText: {
    fontSize: 14,
    color: colors.gray400,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: spacing.md,
  },
  textInput: {
    backgroundColor: colors.gray100,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveContainer: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  continueContainer: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
});
