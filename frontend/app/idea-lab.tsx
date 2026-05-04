import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../src/utils/theme';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Input } from '../src/components/Input';
import { Select } from '../src/components/Select';
import { useProject } from '../src/context/ProjectContext';
import { api, formatApiError } from '../src/utils/api';

const TONES = [
  { label: 'Cozy', value: 'cozy' },
  { label: 'Funny', value: 'funny' },
  { label: 'Adventurous', value: 'adventurous' },
  { label: 'Emotional', value: 'emotional' },
  { label: 'Bedtime Calm', value: 'bedtime calm' },
];

const AGE_RANGES = [
  { label: '3-5 years', value: '3-5' },
  { label: '4-6 years', value: '4-6' },
  { label: '5-8 years', value: '5-8' },
];

const PAGE_COUNTS = [
  { label: '8 pages', value: '8' },
  { label: '10 pages', value: '10' },
  { label: '12 pages', value: '12' },
];

const EXAMPLE_IDEA = `A child with a magical blanket cape protects his baby brother from night monsters at bedtime and learns what it means to be a big brother hero.`;

const EXAMPLE_IDEA_2 = `A brave child discovers a friendly kraken living in the bedroom closet who's afraid of the dark, and they help each other overcome their fears.`;

const SURPRISE_IDEAS = [
  "A shy cloud who can't make rain finds courage when a garden desperately needs water.",
  "A little robot discovers emotions when it befriends a lonely child in a park.",
  "A bedtime story about a moon who is afraid of the dark until the stars teach her to shine.",
  "A young dragon who can only breathe bubbles instead of fire saves the day at a birthday party.",
  "A magical paintbrush brings a child's drawings to life, and together they go on adventures.",
];

export default function IdeaLabScreen() {
  const router = useRouter();
  const { setCurrentProject, setCharacters, setPages, setIsLoading } = useProject();
  
  const [idea, setIdea] = useState('');
  const [tone, setTone] = useState('cozy');
  const [ageRange, setAgeRange] = useState('3-5');
  const [pageCount, setPageCount] = useState('10');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Universe / LoreEngine mode
  const [universeMode, setUniverseMode] = useState(false);
  const [universes, setUniverses] = useState<{ id: string; name: string; genre: string; tone: string }[]>([]);
  const [loadingUniverses, setLoadingUniverses] = useState(false);
  const [selectedUniverseId, setSelectedUniverseId] = useState<string | null>(null);

  const handleToggleUniverseMode = async () => {
    const next = !universeMode;
    setUniverseMode(next);
    if (next && universes.length === 0) {
      setLoadingUniverses(true);
      try {
        const res = await api.get('/universes');
        setUniverses(res.data || []);
      } catch {
        setUniverses([]);
        setError('Could not load universes. Check your connection and try again.');
      } finally {
        setLoadingUniverses(false);
      }
    }
    if (!next) {
      setSelectedUniverseId(null);
    }
  };

  const handleGenerateBlueprint = async () => {
    if (!idea.trim()) {
      setError('Please enter a story idea');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Generate blueprint (with optional lore context)
      const blueprintRes = await api.post('/generate/blueprint', {
        original_idea: idea,
        tone,
        age_range: ageRange,
        page_count: parseInt(pageCount),
        ...(selectedUniverseId ? { lore_universe_id: selectedUniverseId } : {}),
      });

      const blueprint = blueprintRes.data;
      if (!blueprint?.outline || !Array.isArray(blueprint.outline)) {
        setError('Invalid blueprint response. Please try again.');
        return;
      }

      // Create project
      const projectRes = await api.post('/projects', {
        title: blueprint.title,
        original_idea: idea,
        tone,
        age_range: ageRange,
        page_count: parseInt(pageCount),
        ...(selectedUniverseId ? { lore_universe_id: selectedUniverseId } : {}),
      });

      // Update project with blueprint data
      await api.put(`/projects/${projectRes.data.id}`, {
        title: blueprint.title,
        hook: blueprint.hook,
        summary: blueprint.summary,
        theme: blueprint.theme,
        outline: blueprint.outline,
      });

      // Create pages from outline
      const pagesData = blueprint.outline.map((beat: string, index: number) => ({
        page_number: index + 1,
        outline_beat: beat,
        page_text: '',
        illustration_prompt: '',
        emotional_beat: '',
      }));

      await api.post(`/projects/${projectRes.data.id}/pages/bulk`, pagesData);
      
      // Create characters from blueprint
      if (blueprint.characters && Array.isArray(blueprint.characters)) {
        const charactersData = blueprint.characters.map((char: any) => ({
          name: char.name || 'Unknown',
          role: char.role || 'supporting',
          personality: char.personality || '',
          appearance: char.appearance || '',
          special_trait: char.special_trait || '',
          notes: '',
        }));
        await api.post(`/projects/${projectRes.data.id}/characters/bulk`, charactersData);
      }

      // Load the full project
      const [fullProject, chars, pages] = await Promise.all([
        api.get(`/projects/${projectRes.data.id}`),
        api.get(`/projects/${projectRes.data.id}/characters`),
        api.get(`/projects/${projectRes.data.id}/pages`),
      ]);

      setCurrentProject(fullProject.data);
      setCharacters(chars.data);
      setPages(pages.data);

      router.push('/blueprint');
    } catch (err: any) {
      setError(formatApiError(err, 'Failed to generate blueprint. Please try again.'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSurpriseMe = () => {
    const randomIdea = SURPRISE_IDEAS[Math.floor(Math.random() * SURPRISE_IDEAS.length)];
    setIdea(randomIdea);
  };

  const handleLoadExample = () => {
    setIdea(EXAMPLE_IDEA);
    setTone('cozy');
    setAgeRange('3-5');
    setPageCount('10');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTitle}>
            <Ionicons name="bulb" size={28} color={colors.primary} />
            <Text style={styles.title}>Idea Lab</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <Text style={styles.subtitle}>
          Start with your story idea. We'll help you build the rest.
        </Text>

        {/* Universe Mode Toggle */}
        <TouchableOpacity
          style={[styles.universeModeToggle, universeMode && styles.universeModeToggleActive]}
          onPress={handleToggleUniverseMode}
          activeOpacity={0.8}
        >
          <Ionicons
            name={universeMode ? 'planet' : 'planet-outline'}
            size={20}
            color={universeMode ? colors.white : colors.primary}
          />
          <Text style={[styles.universeModeToggleText, universeMode && styles.universeModeToggleTextActive]}>
            {universeMode ? 'Creating from Universe ✓' : 'Create from Universe (LoreEngine)'}
          </Text>
        </TouchableOpacity>

        {/* Universe Picker */}
        {universeMode && (
          <Card style={styles.universeCard} variant="outlined">
            <Text style={styles.universeCardTitle}>Select a Universe</Text>
            {loadingUniverses ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
            ) : universes.length === 0 ? (
              <Text style={styles.universeEmpty}>
                No universes found. Sync a universe from SagaArchitect/MythLoreBuilder first.
              </Text>
            ) : (
              universes.map((u) => (
                <TouchableOpacity
                  key={u.id}
                  style={[
                    styles.universeItem,
                    selectedUniverseId === u.id && styles.universeItemSelected,
                  ]}
                  onPress={() => setSelectedUniverseId(selectedUniverseId === u.id ? null : u.id)}
                  activeOpacity={0.75}
                >
                  <View style={styles.universeItemInner}>
                    <Ionicons
                      name={selectedUniverseId === u.id ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={selectedUniverseId === u.id ? colors.primary : colors.textSecondary}
                    />
                    <View style={styles.universeItemText}>
                      <Text style={[
                        styles.universeName,
                        selectedUniverseId === u.id && styles.universeNameSelected,
                      ]}>
                        {u.name}
                      </Text>
                      {(u.genre || u.tone) ? (
                        <Text style={styles.universeMeta}>{[u.genre, u.tone].filter(Boolean).join(' · ')}</Text>
                      ) : null}
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
            {selectedUniverseId && (
              <Text style={styles.universeSelectedNote}>
                ✨ Story will be generated consistent with this universe's canon, characters, factions, and world rules.
              </Text>
            )}
          </Card>
        )}

        {/* Main Form */}
        <Card style={styles.formCard} variant="elevated">
          <Input
            label="Your Story Idea"
            placeholder="A brave little robot discovers emotions when..."
            value={idea}
            onChangeText={setIdea}
            multiline
            numberOfLines={5}
            containerStyle={styles.ideaInput}
          />

          <View style={styles.row}>
            <View style={styles.halfField}>
              <Select
                label="Tone"
                value={tone}
                options={TONES}
                onChange={setTone}
              />
            </View>
            <View style={styles.halfField}>
              <Select
                label="Age Range"
                value={ageRange}
                options={AGE_RANGES}
                onChange={setAgeRange}
              />
            </View>
          </View>

          <Select
            label="Page Count"
            value={pageCount}
            options={PAGE_COUNTS}
            onChange={setPageCount}
          />
        </Card>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Button
            title="Generate Blueprint"
            onPress={handleGenerateBlueprint}
            size="lg"
            loading={isGenerating}
            disabled={!idea.trim()}
            icon={<Ionicons name="sparkles" size={22} color={colors.white} />}
            style={styles.generateButton}
          />

          <View style={styles.secondaryActions}>
            <Button
              title="Surprise Me"
              onPress={handleSurpriseMe}
              variant="outline"
              size="md"
              icon={<Ionicons name="shuffle" size={20} color={colors.primary} />}
              style={styles.secondaryButton}
            />
            <Button
              title="Example 1"
              onPress={handleLoadExample}
              variant="ghost"
              size="md"
              icon={<Ionicons name="book" size={20} color={colors.primary} />}
              style={styles.secondaryButton}
            />
            <Button
              title="Example 2"
              onPress={() => {
                setIdea(EXAMPLE_IDEA_2);
                setTone('adventurous');
                setAgeRange('4-6');
                setPageCount('10');
              }}
              variant="ghost"
              size="md"
              icon={<Ionicons name="fish" size={20} color={colors.primary} />}
              style={styles.secondaryButton}
            />
          </View>
        </View>

        {/* Error Banner */}
        {error && (
          <Card style={styles.errorCard} variant="outlined">
            <View style={styles.errorRow}>
              <Ionicons name="warning" size={18} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          </Card>
        )}

        {/* Tips Card */}
        <Card style={styles.tipsCard} variant="outlined">
          <View style={styles.tipsHeader}>
            <Ionicons name="information-circle" size={20} color={colors.info} />
            <Text style={styles.tipsTitle}>Tips for Great Ideas</Text>
          </View>
          <View style={styles.tipsList}>
            <Text style={styles.tipItem}>• Include a main character and their challenge</Text>
            <Text style={styles.tipItem}>• Think about what lesson or emotion to convey</Text>
            <Text style={styles.tipItem}>• Picture books work best with simple, clear plots</Text>
            <Text style={styles.tipItem}>• Don't worry about perfection - you can edit later!</Text>
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
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
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  formCard: {
    padding: spacing.lg,
  },
  ideaInput: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfField: {
    flex: 1,
  },
  actions: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  generateButton: {
    width: '100%',
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
  },
  secondaryButton: {
    flex: 1,
    maxWidth: 180,
  },
  tipsCard: {
    marginTop: spacing.xl,
    padding: spacing.md,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.info,
  },
  tipsList: {
    gap: spacing.xs,
  },
  tipItem: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  universeModeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.primary,
    marginBottom: spacing.md,
  },
  universeModeToggleActive: {
    backgroundColor: colors.primary,
  },
  universeModeToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  universeModeToggleTextActive: {
    color: colors.white,
  },
  universeCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  universeCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  universeEmpty: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  universeItem: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  universeItemSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.bgEnd,
  },
  universeItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  universeItemText: {
    flex: 1,
  },
  universeName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  universeNameSelected: {
    color: colors.primary,
  },
  universeMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  universeSelectedNote: {
    fontSize: 12,
    color: colors.primary,
    marginTop: spacing.sm,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  errorCard: {
    marginTop: spacing.md,
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
