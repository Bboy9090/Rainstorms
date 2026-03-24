import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { colors, spacing, borderRadius, shadows } from '../src/utils/theme';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Loading } from '../src/components/Loading';
import { useProject } from '../src/context/ProjectContext';
import { api } from '../src/utils/api';

export default function ExportScreen() {
  const router = useRouter();
  const { currentProject, pages, characters, isLoading } = useProject();
  
  const [isExportingStory, setIsExportingStory] = useState(false);
  const [isExportingPrompts, setIsExportingPrompts] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  if (isLoading || !currentProject) {
    return <Loading message="Loading project..." fullScreen />;
  }

  const handleExportStoryPDF = async () => {
    setIsExportingStory(true);
    try {
      const baseUrl = api.defaults.baseURL?.replace('/api', '') || '';
      const pdfUrl = `${baseUrl}/api/projects/${currentProject.id}/export/story-pdf`;
      
      if (Platform.OS === 'web') {
        window.open(pdfUrl, '_blank');
      } else {
        await Linking.openURL(pdfUrl);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to export PDF');
    } finally {
      setIsExportingStory(false);
    }
  };

  const handleExportPromptsPDF = async () => {
    setIsExportingPrompts(true);
    try {
      const baseUrl = api.defaults.baseURL?.replace('/api', '') || '';
      const pdfUrl = `${baseUrl}/api/projects/${currentProject.id}/export/prompts-pdf`;
      
      if (Platform.OS === 'web') {
        window.open(pdfUrl, '_blank');
      } else {
        await Linking.openURL(pdfUrl);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to export prompts PDF');
    } finally {
      setIsExportingPrompts(false);
    }
  };

  const handleCopyText = async () => {
    try {
      const response = await api.get(`/projects/${currentProject.id}/export/text`);
      const text = response.data.text;
      
      if (Platform.OS === 'web' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 3000);
    } catch (err) {
      Alert.alert('Error', 'Failed to copy text');
    }
  };

  const handleExportJSON = async () => {
    try {
      const response = await api.get(`/projects/${currentProject.id}/export/json`);
      const jsonString = JSON.stringify(response.data, null, 2);
      
      if (Platform.OS === 'web') {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentProject.title.replace(/\s+/g, '_')}_backup.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to export JSON');
    }
  };

  const pagesWithText = pages.filter((p) => p.page_text).length;
  const pagesWithPrompts = pages.filter((p) => p.illustration_prompt).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Ionicons name="download" size={28} color={colors.primary} />
          <Text style={styles.title}>Export</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Project Summary */}
      <Card style={styles.summaryCard} variant="elevated">
        <Text style={styles.bookTitle}>{currentProject.title}</Text>
        <Text style={styles.bookSummary}>{currentProject.hook}</Text>
        
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{pages.length}</Text>
            <Text style={styles.statLabel}>Pages</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{characters.length}</Text>
            <Text style={styles.statLabel}>Characters</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: pagesWithText === pages.length ? colors.success : colors.warning }]}>
              {pagesWithText}/{pages.length}
            </Text>
            <Text style={styles.statLabel}>Text Written</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: pagesWithPrompts === pages.length ? colors.success : colors.warning }]}>
              {pagesWithPrompts}/{pages.length}
            </Text>
            <Text style={styles.statLabel}>Prompts</Text>
          </View>
        </View>
      </Card>

      {/* Export Options */}
      <Text style={styles.sectionTitle}>Export Options</Text>

      {/* Story PDF */}
      <Card style={styles.exportCard}>
        <View style={styles.exportHeader}>
          <View style={[styles.exportIcon, { backgroundColor: colors.tintPrimary }]}>
            <Ionicons name="document" size={24} color={colors.primary} />
          </View>
          <View style={styles.exportInfo}>
            <Text style={styles.exportTitle}>Story PDF</Text>
            <Text style={styles.exportDesc}>
              Complete story draft with title page, summary, and all page text
            </Text>
          </View>
        </View>
        <Button
          title="Export Story PDF"
          onPress={handleExportStoryPDF}
          loading={isExportingStory}
          icon={<Ionicons name="download" size={18} color={colors.white} />}
          style={styles.exportButton}
        />
      </Card>

      {/* Prompts PDF */}
      <Card style={styles.exportCard}>
        <View style={styles.exportHeader}>
          <View style={[styles.exportIcon, { backgroundColor: colors.tintAccent }]}>
            <Ionicons name="brush" size={24} color={colors.accent} />
          </View>
          <View style={styles.exportInfo}>
            <Text style={styles.exportTitle}>Illustration Prompts</Text>
            <Text style={styles.exportDesc}>
              All illustration prompts with character references for your artist
            </Text>
          </View>
        </View>
        <Button
          title="Export Prompts PDF"
          onPress={handleExportPromptsPDF}
          loading={isExportingPrompts}
          variant={pagesWithPrompts > 0 ? 'primary' : 'outline'}
          disabled={pagesWithPrompts === 0}
          icon={<Ionicons name="download" size={18} color={pagesWithPrompts > 0 ? colors.white : colors.primary} />}
          style={styles.exportButton}
        />
      </Card>

      {/* Copy Text */}
      <Card style={styles.exportCard}>
        <View style={styles.exportHeader}>
          <View style={[styles.exportIcon, { backgroundColor: colors.tintSuccess }]}>
            <Ionicons name="copy" size={24} color={colors.success} />
          </View>
          <View style={styles.exportInfo}>
            <Text style={styles.exportTitle}>Copy Full Text</Text>
            <Text style={styles.exportDesc}>
              Copy all story text to clipboard for use in other applications
            </Text>
          </View>
        </View>
        <Button
          title={copiedText ? 'Copied!' : 'Copy Book Text'}
          onPress={handleCopyText}
          variant="outline"
          icon={<Ionicons name={copiedText ? 'checkmark' : 'clipboard'} size={18} color={colors.primary} />}
          style={styles.exportButton}
        />
      </Card>

      {/* JSON Backup */}
      <Card style={styles.exportCard}>
        <View style={styles.exportHeader}>
          <View style={[styles.exportIcon, { backgroundColor: '#F3E8FF' }]}>
            <Ionicons name="code" size={24} color="#8B5CF6" />
          </View>
          <View style={styles.exportInfo}>
            <Text style={styles.exportTitle}>Project Backup (JSON)</Text>
            <Text style={styles.exportDesc}>
              Download complete project data including all characters and pages
            </Text>
          </View>
        </View>
        <Button
          title="Download JSON"
          onPress={handleExportJSON}
          variant="ghost"
          icon={<Ionicons name="cloud-download" size={18} color={colors.primary} />}
          style={styles.exportButton}
        />
      </Card>

      {/* Publishing Center CTA */}
      <Card style={[styles.exportCard, { borderWidth: 2, borderColor: colors.primary }]}>
        <View style={styles.exportHeader}>
          <View style={[styles.exportIcon, { backgroundColor: colors.tintPrimary }]}>
            <Ionicons name="library" size={24} color={colors.primary} />
          </View>
          <View style={styles.exportInfo}>
            <Text style={styles.exportTitle}>Publishing Center</Text>
            <Text style={styles.exportDesc}>
              Prepare print-ready files for Amazon KDP, IngramSpark, and Lulu.
              Add metadata, configure trim size, validate, and export.
            </Text>
          </View>
        </View>
        <Button
          title="Open Publishing Center"
          onPress={() => router.push('/publishing-center')}
          icon={<Ionicons name="arrow-forward" size={18} color={colors.white} />}
          style={styles.exportButton}
        />
      </Card>

      {/* Continue Working */}
      <View style={styles.bottomActions}>
        <Button
          title="Back to Page Builder"
          onPress={() => router.push('/page-builder')}
          variant="outline"
          size="md"
          icon={<Ionicons name="create" size={18} color={colors.primary} />}
        />
        <Button
          title="Start New Story"
          onPress={() => router.push('/idea-lab')}
          variant="ghost"
          size="md"
          icon={<Ionicons name="add" size={18} color={colors.primary} />}
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
  summaryCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  bookTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  bookSummary: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    fontStyle: 'italic',
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    paddingTop: spacing.md,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  exportCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  exportHeader: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  exportIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  exportInfo: {
    flex: 1,
  },
  exportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  exportDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  exportButton: {
    marginTop: spacing.sm,
  },
  bottomActions: {
    marginTop: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
});
