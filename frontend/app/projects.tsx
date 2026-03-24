import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../src/utils/theme';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Loading } from '../src/components/Loading';
import { useAuth } from '../src/context/AuthContext';
import { useProject } from '../src/context/ProjectContext';
import { api, formatApiError } from '../src/utils/api';

interface ProjectSummary {
  id: string;
  title: string;
  original_idea: string;
  tone: string;
  age_range: string;
  page_count: number;
  visibility?: string;
  created_at: string;
  updated_at: string;
}

const VISIBILITY_OPTIONS = [
  { value: 'private', label: '🔒 Keep Private', description: 'Only you can see this' },
  { value: 'shared_archetype', label: '🔮 Share as Archetype', description: 'Abstract pattern only — no exact names or details' },
  { value: 'public_template', label: '📖 Share as Template', description: 'Intentional reusable template' },
] as const;

export default function ProjectsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { loadProject, setIsLoading } = useProject();
  
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user]);

  const fetchProjects = async () => {
    setIsLoadingProjects(true);
    try {
      const response = await api.get('/projects');
      setProjects(response.data);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const handleOpenProject = async (projectId: string) => {
    setIsLoading(true);
    await loadProject(projectId);
    router.push('/blueprint');
  };

  const handleDeleteProject = async (projectId: string) => {
    Alert.alert(
      'Delete Project',
      'Are you sure you want to delete this project? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(projectId);
            try {
              await api.delete(`/projects/${projectId}`);
              setProjects(projects.filter((p) => p.id !== projectId));
            } catch (err) {
              Alert.alert('Error', 'Failed to delete project');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const handleSetVisibility = async (project: ProjectSummary, visibility: string) => {
    if (visibility === project.visibility) return;
    setSharingId(project.id);
    try {
      await api.put(`/projects/${project.id}/visibility`, { visibility });
      // If sharing to pool, also create/update the pool entry
      if (visibility === 'shared_archetype' || visibility === 'public_template') {
        await api.post('/lore-pool/share', {
          source_type: 'book_concept',
          source_id: project.id,
          visibility,
        });
        Alert.alert(
          'Shared to Lore Pool ✨',
          `This project has been abstracted and added to the Lore Pool as an archetype. No exact names or story details were shared.`
        );
      }
      setProjects((prev) =>
        prev.map((p) => (p.id === project.id ? { ...p, visibility } : p))
      );
    } catch (err: any) {
      Alert.alert('Error', formatApiError(err, 'Failed to update visibility.'));
    } finally {
      setSharingId(null);
    }
  };

  const handleVisibilityPicker = (project: ProjectSummary) => {
    Alert.alert(
      'Content Visibility',
      'Choose how this project is shared. Private content is never used in the Lore Pool.',
      VISIBILITY_OPTIONS.map((opt) => ({
        text: opt.label,
        onPress: () => handleSetVisibility(project, opt.value),
        style: opt.value === 'private' ? 'destructive' : 'default',
      })).concat([{ text: 'Cancel', style: 'cancel', onPress: () => {} }])
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTitle}>
            <Ionicons name="folder" size={28} color={colors.primary} />
            <Text style={styles.title}>My Projects</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
        
        <View style={styles.emptyState}>
          <Ionicons name="person-outline" size={64} color={colors.gray300} />
          <Text style={styles.emptyTitle}>Sign in to see your projects</Text>
          <Text style={styles.emptyText}>Create an account to save your stories</Text>
          <Button
            title="Sign In"
            onPress={() => router.push('/auth')}
            style={styles.signInButton}
          />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Ionicons name="folder" size={28} color={colors.primary} />
          <Text style={styles.title}>My Projects</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* New Project Button */}
      <Button
        title="New Story"
        onPress={() => router.push('/idea-lab')}
        icon={<Ionicons name="add" size={20} color={colors.white} />}
        style={styles.newButton}
      />

      {/* Projects List */}
      {isLoadingProjects ? (
        <Loading message="Loading projects..." />
      ) : projects.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Ionicons name="book-outline" size={48} color={colors.gray300} />
          <Text style={styles.emptyTitle}>No projects yet</Text>
          <Text style={styles.emptyText}>Start creating your first children's book!</Text>
        </Card>
      ) : (
        <View style={styles.projectsList}>
          {projects.map((project) => (
            <Card key={project.id} style={styles.projectCard} variant="elevated">
              <TouchableOpacity
                style={styles.projectContent}
                onPress={() => handleOpenProject(project.id)}
              >
                <View style={styles.projectHeader}>
                  <Text style={styles.projectTitle} numberOfLines={1}>
                    {project.title || 'Untitled Project'}
                  </Text>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteProject(project.id)}
                    disabled={deletingId === project.id}
                  >
                    <Ionicons
                      name={deletingId === project.id ? 'hourglass' : 'trash-outline'}
                      size={18}
                      color={colors.error}
                    />
                  </TouchableOpacity>
                </View>
                
                <Text style={styles.projectIdea} numberOfLines={2}>
                  {project.original_idea}
                </Text>
                
                <View style={styles.projectMeta}>
                  <View style={styles.metaTag}>
                    <Text style={styles.metaText}>{project.age_range} yrs</Text>
                  </View>
                  <View style={styles.metaTag}>
                    <Text style={styles.metaText}>{project.page_count} pages</Text>
                  </View>
                  <View style={styles.metaTag}>
                    <Text style={styles.metaText}>{project.tone}</Text>
                  </View>
                </View>
                
                <Text style={styles.projectDate}>
                  Updated {formatDate(project.updated_at)}
                </Text>
              </TouchableOpacity>

              {/* Visibility / Lore Pool sharing control */}
              <TouchableOpacity
                style={[
                  styles.visibilityRow,
                  (project.visibility === 'shared_archetype' || project.visibility === 'public_template')
                    && styles.visibilityRowShared,
                ]}
                onPress={() => handleVisibilityPicker(project)}
                disabled={sharingId === project.id}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={
                    project.visibility === 'shared_archetype'
                      ? 'planet'
                      : project.visibility === 'public_template'
                      ? 'globe'
                      : 'lock-closed-outline'
                  }
                  size={14}
                  color={
                    project.visibility === 'shared_archetype' || project.visibility === 'public_template'
                      ? colors.primary
                      : colors.textMuted
                  }
                />
                <Text style={[
                  styles.visibilityLabel,
                  (project.visibility === 'shared_archetype' || project.visibility === 'public_template')
                    && styles.visibilityLabelShared,
                ]}>
                  {sharingId === project.id
                    ? 'Updating…'
                    : project.visibility === 'shared_archetype'
                    ? 'Shared as Archetype'
                    : project.visibility === 'public_template'
                    ? 'Shared as Template'
                    : 'Private — tap to share to Lore Pool'}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            </Card>
          ))}
        </View>
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
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
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
  newButton: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  projectsList: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  projectCard: {
    padding: spacing.lg,
  },
  projectContent: {
    flex: 1,
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  projectTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginRight: spacing.sm,
  },
  deleteButton: {
    padding: spacing.xs,
  },
  projectIdea: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  projectMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  metaTag: {
    backgroundColor: colors.gray100,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
  },
  metaText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  projectDate: {
    fontSize: 12,
    color: colors.textMuted,
  },
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  visibilityRowShared: {
    borderTopColor: colors.primary + '33',
    backgroundColor: colors.bgEnd,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.xs,
  },
  visibilityLabel: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
  },
  visibilityLabelShared: {
    color: colors.primary,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyCard: {
    padding: spacing.xxl,
    alignItems: 'center',
    marginHorizontal: spacing.lg,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  signInButton: {
    marginTop: spacing.lg,
  },
});
