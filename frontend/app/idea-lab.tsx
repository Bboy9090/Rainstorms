import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../src/utils/theme';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Input } from '../src/components/Input';
import { Select } from '../src/components/Select';
import { useProject } from '../src/context/ProjectContext';
import { api } from '../src/utils/api';

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

const SURPRISE_IDEAS = [
  "A shy cloud who can't make rain finds courage when a garden desperately needs water.",
  "A little robot discovers emotions when it befriends a lonely child in a park.",
  "A bedtime story about a moon who is afraid of the dark until the stars teach her to shine.",
  "A young dragon who can only breathe bubbles instead of fire saves the day at a birthday party.",
  "A magical paintbrush brings a child's drawings to life, and together they go on adventures.",
];

export default function IdeaLabScreen() {
  const router = useRouter();
  const { setCurrentProject, setCharacters, setPages, setIsLoading, setError } = useProject();
  
  const [idea, setIdea] = useState('');
  const [tone, setTone] = useState('cozy');
  const [ageRange, setAgeRange] = useState('3-5');
  const [pageCount, setPageCount] = useState('10');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateBlueprint = async () => {
    if (!idea.trim()) {
      setError('Please enter a story idea');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Generate blueprint
      const blueprintRes = await api.post('/generate/blueprint', {
        original_idea: idea,
        tone,
        age_range: ageRange,
        page_count: parseInt(pageCount),
      });

      const blueprint = blueprintRes.data;

      // Create project
      const projectRes = await api.post('/projects', {
        title: blueprint.title,
        original_idea: idea,
        tone,
        age_range: ageRange,
        page_count: parseInt(pageCount),
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
      setError(err.response?.data?.detail || 'Failed to generate blueprint. Please try again.');
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
              title="Load Example"
              onPress={handleLoadExample}
              variant="ghost"
              size="md"
              icon={<Ionicons name="document-text" size={20} color={colors.primary} />}
              style={styles.secondaryButton}
            />
          </View>
        </View>

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
});
