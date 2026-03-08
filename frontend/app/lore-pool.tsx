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
import { useProject } from '../src/context/ProjectContext';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/utils/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PoolEntry {
  id: string;
  source_type: string;
  visibility: string;
  archetype_name: string;
  role_type: string;
  tone: string;
  age_band: string;
  visual_tags: string[];
  theme_tags: string[];
  summary_template: string;
  safety_level: string;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FILTER_CHIPS = [
  { key: 'bedtime', label: '🌙 Bedtime', icon: 'moon-outline' },
  { key: 'funny', label: '😄 Funny', icon: 'happy-outline' },
  { key: 'adventure', label: '⚔️ Adventure', icon: 'compass-outline' },
  { key: 'emotional', label: '💛 Emotional', icon: 'heart-outline' },
  { key: 'fantasy', label: '✨ Fantasy', icon: 'sparkles-outline' },
  { key: 'sibling', label: '👦 Sibling', icon: 'people-outline' },
  { key: 'animal_hero', label: '🐾 Animal Hero', icon: 'paw-outline' },
  { key: 'magic', label: '🪄 Magic', icon: 'star-outline' },
] as const;

const VISIBILITY_LABELS: Record<string, { label: string; color: string }> = {
  private: { label: 'Private', color: colors.gray400 },
  shared_archetype: { label: 'Shared Archetype', color: colors.primary },
  public_template: { label: 'Public Template', color: colors.success },
  demo_only: { label: 'Demo Only', color: colors.accent },
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
  const [error, setError] = useState<string | null>(null);
  const [generatedBlueprint, setGeneratedBlueprint] = useState<any | null>(null);

  // ── fetch pool entries ──
  const fetchPool = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = selectedFilters.length
        ? { filters: selectedFilters.join(',') }
        : {};
      const res = await api.get('/lore-pool', { params });
      setEntries(res.data || []);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load the Lore Pool. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedFilters]);

  useEffect(() => {
    fetchPool();
  }, [fetchPool]);

  // ── toggle filter chip ──
  const toggleFilter = (key: string) => {
    setSelectedFilters((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]
    );
    setGeneratedBlueprint(null);
  };

  // ── generate from pool ──
  const handleGenerateFromPool = async () => {
    setGenerating(true);
    setError(null);
    setGeneratedBlueprint(null);
    try {
      const res = await api.post('/lore-pool/generate', {
        filters: selectedFilters,
        page_count: 10,
      });
      setGeneratedBlueprint(res.data);
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          'Could not generate from the Lore Pool. Try a different filter or add more archetypes.'
      );
    } finally {
      setGenerating(false);
    }
  };

  // ── use generated blueprint as a new project ──
  const handleUseBlueprint = async () => {
    if (!generatedBlueprint) return;
    setGenerating(true);
    try {
      const projectRes = await api.post('/projects', {
        title: generatedBlueprint.title,
        original_idea: generatedBlueprint.summary,
        tone: 'cozy',
        age_range: '4-6',
        page_count: generatedBlueprint.outline?.length || 10,
        origin_type: 'generated_from_pool',
      });

      await api.put(`/projects/${projectRes.data.id}`, {
        title: generatedBlueprint.title,
        hook: generatedBlueprint.hook,
        summary: generatedBlueprint.summary,
        theme: generatedBlueprint.theme,
        outline: generatedBlueprint.outline,
      });

      const pagesData = (generatedBlueprint.outline || []).map(
        (beat: string, index: number) => ({
          page_number: index + 1,
          outline_beat: beat,
          page_text: '',
          illustration_prompt: '',
          emotional_beat: '',
        })
      );
      await api.post(`/projects/${projectRes.data.id}/pages/bulk`, pagesData);

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
      setError(err.response?.data?.detail || 'Failed to create project from blueprint.');
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
          </Text>
        </View>
      </Card>

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
      {selectedFilters.length > 0 && (
        <TouchableOpacity onPress={() => { setSelectedFilters([]); setGeneratedBlueprint(null); }}>
          <Text style={styles.clearFilters}>✕ Clear filters</Text>
        </TouchableOpacity>
      )}

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

      {/* Generated Blueprint Result */}
      {generatedBlueprint && (
        <Card style={styles.blueprintCard} variant="elevated">
          <View style={styles.blueprintHeader}>
            <Ionicons name="document-text" size={22} color={colors.primary} />
            <Text style={styles.blueprintTitle}>Generated Blueprint</Text>
          </View>
          <Text style={styles.blueprintName}>{generatedBlueprint.title}</Text>
          <Text style={styles.blueprintMeta}>
            {generatedBlueprint.theme}
          </Text>
          {generatedBlueprint.hook ? (
            <Text style={styles.blueprintHook}>"{generatedBlueprint.hook}"</Text>
          ) : null}
          <Text style={styles.poolNote}>
            ✨ Generated from {generatedBlueprint._archetype_count ?? '?'} shared archetypes.
            All names and plot details are original — none were copied from the pool.
          </Text>
          <View style={styles.blueprintActions}>
            <Button
              title="Use This Story"
              onPress={handleUseBlueprint}
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
            {selectedFilters.length > 0
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

  return (
    <Card style={styles.entryCard} variant="outlined">
      {/* Row: archetype name + visibility badge */}
      <View style={styles.entryHeader}>
        <View style={styles.entryTitleRow}>
          <Ionicons
            name={entry.source_type === 'character' ? 'person-circle-outline' : 'book-outline'}
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

      {/* Role type */}
      {entry.role_type ? (
        <Text style={styles.entryRole}>{entry.role_type}</Text>
      ) : null}

      {/* Summary template */}
      {entry.summary_template ? (
        <Text style={styles.entrySummary} numberOfLines={3}>
          {entry.summary_template}
        </Text>
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
  poolNote: {
    fontSize: 12,
    color: colors.success,
    marginBottom: spacing.md,
    lineHeight: 18,
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
  entryRole: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs, fontStyle: 'italic' },
  entrySummary: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },

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
