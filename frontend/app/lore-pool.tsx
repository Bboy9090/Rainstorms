import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../src/utils/theme';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Select } from '../src/components/Select';
import { useProject } from '../src/context/ProjectContext';
import { useAuth } from '../src/context/AuthContext';
import { api, formatApiError } from '../src/utils/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PoolEntry {
  id: string;
  source_type: string;
  source_app: string;
  visibility: string;
  archetype_name: string;
  category: string;
  role_type: string;
  role_pattern: string;
  ideology_pattern: string;
  conflict_pattern: string;
  location_pattern: string;
  tone: string;
  genre: string;
  age_band: string;
  visual_tags: string[];
  theme_tags: string[];
  abstraction_summary: string;
  summary_template: string;
  safety_level: string;
  allow_derivatives: boolean;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FILTER_CHIPS = [
  { key: 'bedtime', label: '🌙 Bedtime' },
  { key: 'funny', label: '😄 Funny' },
  { key: 'adventure', label: '⚔️ Adventure' },
  { key: 'emotional', label: '💛 Emotional' },
  { key: 'fantasy', label: '✨ Fantasy' },
  { key: 'sibling', label: '👦 Sibling' },
  { key: 'animal_hero', label: '🐾 Animal Hero' },
  { key: 'magic', label: '🪄 Magic' },
  { key: 'mystery', label: '🔍 Mystery' },
  { key: 'friendship', label: '🤝 Friendship' },
  { key: 'nature', label: '🌿 Nature' },
  { key: 'sci_fi', label: '🤖 Sci-Fi' },
  { key: 'courage', label: '🦁 Courage' },
] as const;

const GENRE_OPTIONS = [
  { label: 'Any genre', value: '' },
  { label: 'Fantasy', value: 'fantasy' },
  { label: 'Adventure', value: 'adventure' },
  { label: 'Bedtime', value: 'bedtime' },
  { label: 'Comedy', value: 'comedy' },
  { label: 'Emotional', value: 'emotional' },
  { label: 'Mystery', value: 'mystery' },
  { label: 'Nature', value: 'nature' },
  { label: 'Friendship', value: 'friendship' },
  { label: 'Sci-Fi', value: 'sci-fi' },
  { label: 'Folklore', value: 'folklore' },
];

const STORY_TYPE_OPTIONS = [
  { label: 'Any type', value: '' },
  { label: 'Picture Book', value: 'picture_book' },
  { label: 'Bedtime Story', value: 'bedtime' },
  { label: 'Early Reader', value: 'early_reader' },
  { label: 'Chapter Book', value: 'chapter_book' },
];

const AGE_BAND_OPTIONS = [
  { label: 'Any age', value: '' },
  { label: '0–2 years', value: '0-2' },
  { label: '3–5 years', value: '3-5' },
  { label: '4–6 years', value: '4-6' },
  { label: '5–8 years', value: '5-8' },
  { label: '6–10 years', value: '6-10' },
];

const GENERATION_MODE_OPTIONS = [
  { label: 'Story Seeds (quick)', value: 'story_seed' },
  { label: 'Full Blueprint', value: 'full_blueprint' },
];

const VISIBILITY_LABELS: Record<string, { label: string; color: string }> = {
  private: { label: 'Private', color: colors.gray400 },
  shared_archetype: { label: 'Shared Archetype', color: colors.primary },
  public_template: { label: 'Public Template', color: colors.success },
  demo_only: { label: 'Demo Only', color: colors.accent },
};

const SOURCE_APP_LABELS: Record<string, string> = {
  rainstorms: '🌧 Rainstorms',
  sagaarch: '📜 SagaARCH',
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LorePoolScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { setCurrentProject, setCharacters, setPages } = useProject();

  const [entries, setEntries] = useState<PoolEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [genre, setGenre] = useState('');
  const [ageBand, setAgeBand] = useState('');
  const [storyType, setStoryType] = useState('');
  const [generationMode, setGenerationMode] = useState('story_seed');
  const [error, setError] = useState<string | null>(null);
  const [generatedResult, setGeneratedResult] = useState<any | null>(null);

  // ── fetch pool entries ──
  const fetchPool = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (selectedFilters.length) params.filters = selectedFilters.join(',');
      if (genre) params.genre = genre;
      if (ageBand) params.age_band = ageBand;
      if (storyType) params.category = storyType;
      // Use new shared-lore-pool endpoint for structured filtering
      const res = await api.get('/shared-lore-pool', { params });
      setEntries(res.data || []);
    } catch (err: any) {
      setError(formatApiError(err, 'Failed to load the Lore Pool. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [selectedFilters, genre, ageBand, storyType]);

  useEffect(() => {
    fetchPool();
  }, [fetchPool]);

  // ── toggle filter chip ──
  const toggleFilter = (key: string) => {
    setSelectedFilters((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]
    );
    setGeneratedResult(null);
  };

  // ── generate from pool ──
  const handleGenerateFromPool = async () => {
    setGenerating(true);
    setError(null);
    setGeneratedResult(null);
    try {
      // Build structured filters object per the API contract
      const filters: Record<string, any> = {};
      if (genre) filters.genre = genre;
      if (ageBand) filters.age_band = ageBand;
      if (storyType) filters.category = storyType;
      // selectedFilters maps to theme_tags list (tag-style chip filters)
      if (selectedFilters.length) filters.theme_tags = selectedFilters;

      const res = await api.post('/shared-lore-pool/generate', {
        filters,
        count: generationMode === 'full_blueprint' ? 1 : 3,
        generation_mode: generationMode || 'fresh_recombination',
      });
      setGeneratedResult(res.data);
    } catch (err: any) {
      setError(formatApiError(err, 'Could not generate from the Lore Pool. Try a different filter or add more archetypes.'));
    } finally {
      setGenerating(false);
    }
  };

  // ── use a story seed or full blueprint as a new project ──
  const handleUseBlueprint = async (item?: any) => {
    // item may be: an individual seed object, a full blueprint, or null (use generatedResult)
    const source = item || generatedResult;
    if (!source) return;

    // Detect whether item is an individual seed (has story_premise but no outline/summary)
    // or a full blueprint (has outline/summary)
    const isSeed = !source.outline && !source.summary && (source.story_premise !== undefined || source.hero_archetype !== undefined);
    const title = source.title || 'Lore Pool Story';
    const idea = isSeed
      ? (source.story_premise || source.hook || '')
      : (source.summary || source.hook || '');
    const tone = source.tone || 'cozy';

    setGenerating(true);
    try {
      const projectRes = await api.post('/projects', {
        title,
        original_idea: idea,
        tone,
        age_range: ageBand || '4-6',
        page_count: source.outline?.length || 10,
        origin_type: 'generated_from_pool',
      });

      await api.put(`/projects/${projectRes.data.id}`, {
        title,
        hook: source.hook || '',
        summary: isSeed ? idea : (source.summary || ''),
        theme: source.theme || '',
        outline: source.outline || [],
      });

      if (source.outline?.length) {
        const pagesData = source.outline.map((beat: string, index: number) => ({
          page_number: index + 1,
          outline_beat: beat,
          page_text: '',
          illustration_prompt: '',
          emotional_beat: '',
        }));
        await api.post(`/projects/${projectRes.data.id}/pages/bulk`, pagesData);
      }

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
      setError(formatApiError(err, 'Failed to create project from blueprint.'));
    } finally {
      setGenerating(false);
    }
  };

  // ── flag an entry ──
  const handleFlag = async (entryId: string) => {
    try {
      await api.put(`/lore-pool/${entryId}/flag`, { flag_suspected_copying: true });
      Alert.alert('Flagged', 'This entry has been flagged for review. Thank you.');
    } catch {
      Alert.alert('Error', 'Could not flag this entry. Please try again.');
    }
  };

  const hasFilters = selectedFilters.length > 0 || genre || ageBand || storyType;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Ionicons name="library" size={28} color={colors.primary} />
          <Text style={styles.title}>Lore Pool</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <Text style={styles.subtitle}>
        Get inspired by shared creative archetypes. All content is abstracted — no exact
        names, plots, or private details are ever exposed.
      </Text>

      {/* Safety Notice */}
      <Card style={styles.safetyCard} variant="outlined">
        <View style={styles.safetyRow}>
          <Ionicons name="shield-checkmark" size={20} color={colors.success} />
          <Text style={styles.safetyText}>
            <Text style={styles.safetyBold}>Safe by design.</Text> All user content is
            private by default. Shared entries are automatically abstracted into role
            patterns, tones, and themes — never exact names or private story text.
            Archetypes may also be contributed by SagaARCH.
          </Text>
        </View>
      </Card>

      {/* Structured Filters */}
      <Text style={styles.sectionLabel}>Narrow by genre, age & type</Text>
      <View style={styles.selectRow}>
        <View style={styles.selectCol}>
          <Select
            label="Genre"
            value={genre}
            options={GENRE_OPTIONS}
            onChange={(v) => { setGenre(v); setGeneratedResult(null); }}
          />
        </View>
        <View style={styles.selectCol}>
          <Select
            label="Age Range"
            value={ageBand}
            options={AGE_BAND_OPTIONS}
            onChange={(v) => { setAgeBand(v); setGeneratedResult(null); }}
          />
        </View>
      </View>
      <Select
        label="Story Type"
        value={storyType}
        options={STORY_TYPE_OPTIONS}
        onChange={(v) => { setStoryType(v); setGeneratedResult(null); }}
      />

      {/* Filter Chips */}
      <Text style={styles.sectionLabel}>Filter inspiration by theme</Text>
      <View style={styles.chipRow}>
        {FILTER_CHIPS.map((chip) => {
          const active = selectedFilters.includes(chip.key);
          return (
            <TouchableOpacity
              key={chip.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => toggleFilter(chip.key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {hasFilters && (
        <TouchableOpacity onPress={() => {
          setSelectedFilters([]);
          setGenre('');
          setAgeBand('');
          setStoryType('');
          setGeneratedResult(null);
        }}>
          <Text style={styles.clearFilters}>✕ Clear all filters</Text>
        </TouchableOpacity>
      )}

      {/* Generation Settings */}
      <View style={styles.genSettingsRow}>
        <View style={{ flex: 1 }}>
          <Select
            label="Output mode"
            value={generationMode}
            options={GENERATION_MODE_OPTIONS}
            onChange={setGenerationMode}
          />
        </View>
      </View>

      {/* Generate Button */}
      <View style={styles.generateRow}>
        <Button
          title="Generate From Lore Pool"
          onPress={handleGenerateFromPool}
          loading={generating}
          disabled={generating}
          size="lg"
          icon={<Ionicons name="sparkles" size={22} color={colors.white} />}
          style={styles.generateButton}
        />
      </View>

      {/* Error */}
      {error && (
        <Card style={styles.errorCard} variant="outlined">
          <View style={styles.errorRow}>
            <Ionicons name="warning" size={18} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        </Card>
      )}

      {/* Story Seed Results — uses `results` array from /shared-lore-pool/generate */}
      {(generatedResult?.results || generatedResult?.seeds) && (
        <View style={styles.seedsContainer}>
          {(() => {
            const items: any[] = generatedResult.results ?? generatedResult.seeds ?? [];
            return (
              <>
                <Text style={styles.seedsTitle}>
                  ✨ {items.length} fresh story seed{items.length !== 1 ? 's' : ''} generated
                </Text>
                <Text style={styles.poolNote}>
                  Built from {generatedResult._archetype_count ?? '?'} shared archetypes. All names and details are original.
                </Text>
                {items.map((seed: any, idx: number) => (
                  <Card key={idx} style={styles.seedCard} variant="elevated">
                    <Text style={styles.seedTitle}>{seed.title}</Text>
                    <Text style={styles.seedTheme}>{seed.theme}</Text>
                    {seed.hook ? <Text style={styles.seedHook}>"{seed.hook}"</Text> : null}
                    {seed.story_premise ? <Text style={styles.seedPremise}>{seed.story_premise}</Text> : null}
                    {seed.inspiration_tags?.length > 0 && (
                      <View style={styles.tagList}>
                        {seed.inspiration_tags.map((t: string) => (
                          <TagChip key={t} label={t} color={colors.primary} />
                        ))}
                      </View>
                    )}
                    {seed.hero_archetype ? (
                      <View style={styles.seedArchRow}>
                        <Ionicons name="person-circle-outline" size={14} color={colors.textMuted} />
                        <Text style={styles.seedArchText}>{seed.hero_archetype}</Text>
                      </View>
                    ) : null}
                    <Button
                      title="Use This Seed"
                      onPress={() => handleUseBlueprint(seed)}
                      variant="outline"
                      size="md"
                      loading={generating}
                      icon={<Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                      style={styles.seedUseButton}
                    />
                  </Card>
                ))}
                <Button
                  title="Generate More"
                  onPress={handleGenerateFromPool}
                  loading={generating}
                  variant="outline"
                  size="md"
                  icon={<Ionicons name="refresh" size={18} color={colors.primary} />}
                  style={{ marginTop: spacing.sm }}
                />
              </>
            );
          })()}
        </View>
      )}

      {/* Full Blueprint Result — only shown when there are no seeds/results */}
      {generatedResult && !generatedResult.results && !generatedResult.seeds && generatedResult.title && (
        <Card style={styles.blueprintCard} variant="elevated">
          <View style={styles.blueprintHeader}>
            <Ionicons name="document-text" size={22} color={colors.primary} />
            <Text style={styles.blueprintTitle}>Generated Blueprint</Text>
          </View>
          <Text style={styles.blueprintName}>{generatedResult.title}</Text>
          <Text style={styles.blueprintMeta}>{generatedResult.theme}</Text>
          {generatedResult.hook ? (
            <Text style={styles.blueprintHook}>"{generatedResult.hook}"</Text>
          ) : null}
          <Text style={styles.poolNote}>
            ✨ Generated from {generatedResult._archetype_count ?? '?'} shared archetypes.
            All names and plot details are original.
          </Text>
          <View style={styles.blueprintActions}>
            <Button
              title="Use This Story"
              onPress={() => handleUseBlueprint()}
              loading={generating}
              size="md"
              icon={<Ionicons name="checkmark-circle" size={20} color={colors.white} />}
              style={{ flex: 1 }}
            />
            <Button
              title="Try Again"
              onPress={handleGenerateFromPool}
              variant="outline"
              size="md"
              loading={generating}
              icon={<Ionicons name="refresh" size={20} color={colors.primary} />}
              style={{ flex: 1 }}
            />
          </View>
        </Card>
      )}

      {/* Pool Entries */}
      <Text style={styles.sectionLabel}>
        Shared archetypes ({entries.length})
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
      ) : entries.length === 0 ? (
        <Card style={styles.emptyCard} variant="outlined">
          <Ionicons name="cloud-outline" size={40} color={colors.gray300} />
          <Text style={styles.emptyTitle}>No archetypes yet</Text>
          <Text style={styles.emptyText}>
            {hasFilters
              ? 'No archetypes match your current filters. Try clearing some filters.'
              : 'Be the first to share! Open any project or character and choose "Share as Archetype".'}
          </Text>
        </Card>
      ) : (
        entries.map((entry) => <PoolEntryCard key={entry.id} entry={entry} onFlag={handleFlag} />)
      )}

      {/* How to Share Section */}
      <Card style={styles.howToCard} variant="outlined">
        <View style={styles.howToHeader}>
          <Ionicons name="information-circle" size={20} color={colors.info} />
          <Text style={styles.howToTitle}>How to share to the Lore Pool</Text>
        </View>
        <Text style={styles.howToStep}>
          1. Open a project or character in your library.
        </Text>
        <Text style={styles.howToStep}>
          2. Tap the visibility control and choose{' '}
          <Text style={styles.howToHighlight}>Share as Archetype</Text> or{' '}
          <Text style={styles.howToHighlight}>Share as Template</Text>.
        </Text>
        <Text style={styles.howToStep}>
          3. Rainstorms automatically strips your exact names and details — only
          creative patterns are shared.
        </Text>
        <Text style={styles.howToStep}>
          4. SagaARCH users can also contribute archetypes from their universes and factions.
        </Text>
        <View style={styles.visibilityLegend}>
          {Object.entries(VISIBILITY_LABELS).map(([key, val]) => (
            <View key={key} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: val.color }]} />
              <Text style={styles.legendText}>
                <Text style={{ fontWeight: '600' }}>{val.label}</Text>
                {key === 'private' && ' — only you'}
                {key === 'shared_archetype' && ' — abstracted pattern only'}
                {key === 'public_template' && ' — intentional reusable template'}
                {key === 'demo_only' && ' — official examples'}
              </Text>
            </View>
          ))}
        </View>
      </Card>
    </ScrollView>
  );
}

// ─── Pool Entry Card ──────────────────────────────────────────────────────────

function _categoryIcon(category: string): React.ComponentProps<typeof Ionicons>['name'] {
  const iconMap: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
    character: 'person-circle-outline',
    faction: 'shield-outline',
    location: 'location-outline',
    arc: 'git-branch-outline',
    world_seed: 'planet-outline',
    book_concept: 'book-outline',
    story_seed: 'bulb-outline',
  };
  return iconMap[category] ?? 'book-outline';
}

function PoolEntryCard({
  entry,
  onFlag,
}: {
  entry: PoolEntry;
  onFlag: (id: string) => void;
}) {
  const visInfo = VISIBILITY_LABELS[entry.visibility] ?? {
    label: entry.visibility,
    color: colors.gray400,
  };
  const sourceLabel = SOURCE_APP_LABELS[entry.source_app] ?? entry.source_app;

  return (
    <Card style={styles.entryCard} variant="outlined">
      {/* Row: archetype name + visibility badge */}
      <View style={styles.entryHeader}>
        <View style={styles.entryTitleRow}>
          <Ionicons
            name={_categoryIcon(entry.category)}
            size={20}
            color={colors.primary}
          />
          <Text style={styles.entryName}>{entry.archetype_name}</Text>
        </View>
        <View style={[styles.visibilityBadge, { backgroundColor: visInfo.color + '22' }]}>
          <Text style={[styles.visibilityBadgeText, { color: visInfo.color }]}>
            {visInfo.label}
          </Text>
        </View>
      </View>

      {/* Source app badge */}
      {entry.source_app && entry.source_app !== 'rainstorms' && (
        <Text style={styles.sourceAppBadge}>{sourceLabel}</Text>
      )}

      {/* Role type */}
      {entry.role_type ? (
        <Text style={styles.entryRole}>{entry.role_type}</Text>
      ) : null}

      {/* Abstraction summary */}
      {entry.abstraction_summary ? (
        <Text style={styles.entrySummary} numberOfLines={3}>
          {entry.abstraction_summary}
        </Text>
      ) : entry.summary_template ? (
        <Text style={styles.entrySummary} numberOfLines={3}>
          {entry.summary_template}
        </Text>
      ) : null}

      {/* Pattern fields */}
      {entry.ideology_pattern ? (
        <Text style={styles.patternText}>⚖️ {entry.ideology_pattern}</Text>
      ) : null}
      {entry.conflict_pattern ? (
        <Text style={styles.patternText}>⚡ {entry.conflict_pattern}</Text>
      ) : null}
      {entry.location_pattern ? (
        <Text style={styles.patternText}>📍 {entry.location_pattern}</Text>
      ) : null}

      {/* Tag rows */}
      <View style={styles.tagSection}>
        {entry.tone ? (
          <View style={styles.tagGroup}>
            <Text style={styles.tagGroupLabel}>Tone</Text>
            <View style={styles.tagList}>
              <TagChip label={entry.tone} color={colors.primaryLight} />
            </View>
          </View>
        ) : null}
        {entry.genre ? (
          <View style={styles.tagGroup}>
            <Text style={styles.tagGroupLabel}>Genre</Text>
            <View style={styles.tagList}>
              <TagChip label={entry.genre} color={colors.secondary} />
            </View>
          </View>
        ) : null}
        {entry.age_band ? (
          <View style={styles.tagGroup}>
            <Text style={styles.tagGroupLabel}>Age</Text>
            <View style={styles.tagList}>
              <TagChip label={entry.age_band} color={colors.accent} />
            </View>
          </View>
        ) : null}
      </View>

      {entry.theme_tags?.length > 0 && (
        <View style={styles.tagSection}>
          <Text style={styles.tagGroupLabel}>Themes</Text>
          <View style={styles.tagList}>
            {entry.theme_tags.slice(0, 6).map((tag) => (
              <TagChip key={tag} label={tag} color={colors.secondary} />
            ))}
          </View>
        </View>
      )}

      {entry.visual_tags?.length > 0 && (
        <View style={styles.tagSection}>
          <Text style={styles.tagGroupLabel}>Visuals</Text>
          <View style={styles.tagList}>
            {entry.visual_tags.slice(0, 6).map((tag) => (
              <TagChip key={tag} label={tag} color={colors.success} />
            ))}
          </View>
        </View>
      )}

      {/* Derivative rules note */}
      {entry.allow_derivatives === false && (
        <Text style={styles.noDerivText}>⚠️ Derivatives not permitted for this archetype</Text>
      )}

      {/* Flag button */}
      <TouchableOpacity
        style={styles.flagButton}
        onPress={() =>
          Alert.alert(
            'Flag this entry?',
            'Flag if you believe this content is too similar to a specific private work.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Flag', style: 'destructive', onPress: () => onFlag(entry.id) },
            ]
          )
        }
        activeOpacity={0.7}
      >
        <Ionicons name="flag-outline" size={14} color={colors.textMuted} />
        <Text style={styles.flagText}>Flag</Text>
      </TouchableOpacity>
    </Card>
  );
}

function TagChip({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.tagChip, { backgroundColor: color + '22' }]}>
      <Text style={[styles.tagChipText, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgStart },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },

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
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: 24, fontWeight: '700', color: colors.textPrimary },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 20,
  },

  safetyCard: { padding: spacing.md, marginBottom: spacing.md },
  safetyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  safetyText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  safetyBold: { fontWeight: '700', color: colors.success },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },

  selectRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  selectCol: { flex: 1 },
  genSettingsRow: { marginTop: spacing.sm, marginBottom: spacing.xs },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.xs },
  chip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.gray300,
    backgroundColor: colors.white,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.bgEnd },
  chipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  chipTextActive: { color: colors.primary, fontWeight: '700' },
  clearFilters: {
    fontSize: 13,
    color: colors.primary,
    textDecorationLine: 'underline',
    marginBottom: spacing.sm,
  },

  generateRow: { marginTop: spacing.md, marginBottom: spacing.md },
  generateButton: { width: '100%' },

  errorCard: { padding: spacing.md, borderColor: colors.error, marginBottom: spacing.md },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  errorText: { flex: 1, fontSize: 14, color: colors.error, lineHeight: 20 },

  seedsContainer: { marginBottom: spacing.lg },
  seedsTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.xs },
  poolNote: { fontSize: 12, color: colors.success, marginBottom: spacing.md, lineHeight: 18 },
  seedCard: { padding: spacing.md, marginBottom: spacing.md },
  seedTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: 2 },
  seedTheme: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs },
  seedHook: { fontSize: 13, fontStyle: 'italic', color: colors.primary, marginBottom: spacing.xs },
  seedPremise: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: spacing.xs },
  seedArchRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.sm },
  seedArchText: { fontSize: 12, color: colors.textMuted },
  seedUseButton: { marginTop: spacing.xs },

  blueprintCard: { padding: spacing.lg, marginBottom: spacing.lg },
  blueprintHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  blueprintTitle: { fontSize: 14, fontWeight: '700', color: colors.primary },
  blueprintName: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  blueprintMeta: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.xs },
  blueprintHook: {
    fontSize: 14,
    fontStyle: 'italic',
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  blueprintActions: { flexDirection: 'row', gap: spacing.sm },

  emptyCard: {
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  entryCard: { padding: spacing.md, marginBottom: spacing.md },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  entryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1 },
  entryName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  visibilityBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: borderRadius.full,
    marginLeft: spacing.xs,
  },
  visibilityBadgeText: { fontSize: 11, fontWeight: '600' },
  sourceAppBadge: { fontSize: 11, color: colors.textMuted, marginBottom: spacing.xs, fontStyle: 'italic' },
  entryRole: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs, fontStyle: 'italic' },
  entrySummary: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  patternText: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
  noDerivText: { fontSize: 11, color: colors.warning, marginTop: spacing.xs },

  tagSection: { marginBottom: spacing.xs },
  tagGroup: { marginBottom: spacing.xs },
  tagGroupLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted, marginBottom: 4 },
  tagList: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tagChip: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: borderRadius.full,
  },
  tagChipText: { fontSize: 12, fontWeight: '500' },

  flagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
    alignSelf: 'flex-end',
  },
  flagText: { fontSize: 12, color: colors.textMuted },

  howToCard: { padding: spacing.md, marginTop: spacing.lg },
  howToHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  howToTitle: { fontSize: 14, fontWeight: '700', color: colors.info },
  howToStep: { fontSize: 13, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.xs },
  howToHighlight: { color: colors.primary, fontWeight: '600' },
  visibilityLegend: { marginTop: spacing.sm, gap: spacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  legendText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
});
