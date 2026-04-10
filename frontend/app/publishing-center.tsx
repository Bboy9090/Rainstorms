import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { colors, spacing, borderRadius, shadows } from '../src/utils/theme';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Loading } from '../src/components/Loading';
import { useProject } from '../src/context/ProjectContext';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/utils/api';

// ── Types ──────────────────────────────────────────────────────────────────────

interface BookMetadata {
  title: string;
  subtitle: string;
  author_name: string;
  pen_name: string;
  series_name: string;
  series_number: number | null;
  book_description: string;
  keywords: string[];
  age_range: string;
  language: string;
  publisher_name: string;
  publication_date: string;
  isbn_status: string;
  copyright_holder: string;
}

interface BookFormat {
  trim_size: string;
  bleed_enabled: boolean;
  paper_type: string;
  cover_finish: string;
  interior_color: string;
  font_embedding: boolean;
}

interface ValidationIssue {
  level: 'warning' | 'error';
  code: string;
  message: string;
}

interface ValidationResult {
  ready: boolean;
  issue_count: number;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  issues: ValidationIssue[];
}

// ── Constants ──────────────────────────────────────────────────────────────────

const TRIM_SIZES = ['8x8', '8.5x8.5', '8.5x11', '10x8'];
const PAPER_TYPES = ['standard', 'premium'];
const COVER_FINISHES = ['matte', 'glossy'];
const INTERIOR_COLORS = ['color', 'bw'];
const ISBN_STATUSES = ['none', 'pending', 'registered'];

const DEFAULT_METADATA: BookMetadata = {
  title: '',
  subtitle: '',
  author_name: '',
  pen_name: '',
  series_name: '',
  series_number: null,
  book_description: '',
  keywords: [],
  age_range: '',
  language: 'en',
  publisher_name: '',
  publication_date: '',
  isbn_status: 'none',
  copyright_holder: '',
};

const DEFAULT_FORMAT: BookFormat = {
  trim_size: '8x8',
  bleed_enabled: true,
  paper_type: 'standard',
  cover_finish: 'matte',
  interior_color: 'color',
  font_embedding: true,
};

const PLATFORMS = [
  {
    key: 'kdp',
    label: 'Amazon KDP',
    icon: 'logo-amazon' as const,
    color: '#FF9900',
    bgColor: '#FFF8F0',
    description: 'Print + Kindle ebook on Amazon',
  },
  {
    key: 'ingram',
    label: 'IngramSpark',
    icon: 'book' as const,
    color: '#C0392B',
    bgColor: '#FFF0EE',
    description: 'Global distribution to bookstores & libraries',
  },
  {
    key: 'lulu',
    label: 'Lulu',
    icon: 'print' as const,
    color: '#6B21A8',
    bgColor: '#FAF0FF',
    description: 'Print-on-demand with direct storefront',
  },
  {
    key: 'all',
    label: 'All Platforms',
    icon: 'download' as const,
    color: colors.primary,
    bgColor: colors.tintPrimary,
    description: 'Download a complete package for all platforms',
  },
];

// ── Component ──────────────────────────────────────────────────────────────────

type Tab = 'metadata' | 'format' | 'validate' | 'export';

export default function PublishingCenterScreen() {
  const router = useRouter();
  const { currentProject, pages, isLoading: projectLoading } = useProject();
  const { token, isLoading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>('metadata');
  const [metadata, setMetadata] = useState<BookMetadata>(DEFAULT_METADATA);
  const [format, setFormat] = useState<BookFormat>(DEFAULT_FORMAT);
  const [keywordsText, setKeywordsText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [exportingPlatform, setExportingPlatform] = useState<string | null>(null);

  // Load publishing metadata — wait for auth to be ready before fetching
  useEffect(() => {
    if (currentProject && !authLoading && token) {
      loadMetadata();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject?.id, authLoading, token]);

  const loadMetadata = useCallback(async () => {
    if (!currentProject) return;
    setIsLoadingMeta(true);
    try {
      const res = await api.get(`/projects/${currentProject.id}/publishing-center/metadata`);
      const data = res.data;
      if (data.book_metadata) {
        setMetadata({ ...DEFAULT_METADATA, ...data.book_metadata });
        setKeywordsText((data.book_metadata.keywords || []).join(', '));
      }
      if (data.book_format) {
        setFormat({ ...DEFAULT_FORMAT, ...data.book_format });
      }
    } catch {
      // Fall back to defaults pre-filled from project
      if (currentProject) {
        setMetadata((m) => ({
          ...m,
          title: m.title || currentProject.title || '',
          age_range: m.age_range || currentProject.age_range || '',
        }));
      }
    } finally {
      setIsLoadingMeta(false);
    }
  }, [currentProject]);

  const handleSave = async () => {
    if (!currentProject) return;
    setIsSaving(true);
    try {
      const keywords = keywordsText
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);
      const metaToSave = { ...metadata, keywords };
      await api.put(`/projects/${currentProject.id}/publishing-center/metadata`, {
        book_metadata: metaToSave,
        book_format: format,
      });
      setMetadata(metaToSave);
      Alert.alert('Saved', 'Publishing metadata saved successfully.');
    } catch {
      Alert.alert('Error', 'Failed to save metadata. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleValidate = async () => {
    if (!currentProject) return;
    setIsValidating(true);
    setValidationResult(null);
    try {
      const res = await api.post(`/projects/${currentProject.id}/publishing-center/validate`);
      setValidationResult(res.data);
    } catch {
      Alert.alert('Error', 'Validation failed. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleExport = async (platform: string) => {
    if (!currentProject) return;
    setExportingPlatform(platform);
    try {
      const baseUrl = api.defaults.baseURL?.replace('/api', '') || '';
      const exportUrl = `${baseUrl}/api/projects/${currentProject.id}/publishing-center/export/${platform}`;
      if (Platform.OS === 'web') {
        window.open(exportUrl, '_blank');
      } else {
        await Linking.openURL(exportUrl);
      }
    } catch {
      Alert.alert('Error', `Failed to export for ${platform}.`);
    } finally {
      setExportingPlatform(null);
    }
  };

  if (projectLoading || !currentProject) {
    return <Loading message="Loading project..." fullScreen />;
  }

  const pagesWithText = pages.filter((p) => p.page_text).length;

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Ionicons name="library" size={28} color={colors.primary} />
          <Text style={styles.headerText}>Publishing Center</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* ── Book Overview Card ── */}
      <View style={styles.overviewWrapper}>
        <Card style={styles.overviewCard} variant="elevated">
          <Text style={styles.bookTitle} numberOfLines={1}>{currentProject.title}</Text>
          <View style={styles.statsRow}>
            <_Stat label="Pages" value={String(pages.length)} />
            <_Stat
              label="Written"
              value={`${pagesWithText}/${pages.length}`}
              color={pagesWithText === pages.length ? colors.success : colors.warning}
            />
            <_Stat label="Trim" value={format.trim_size + '"'} />
            <_Stat label="Format" value={format.interior_color === 'color' ? 'Color' : 'B&W'} />
          </View>
        </Card>
      </View>

      {/* ── Tab Bar ── */}
      <View style={styles.tabBar}>
        {(
          [
            { key: 'metadata', icon: 'information-circle', label: 'Metadata' },
            { key: 'format', icon: 'settings', label: 'Format' },
            { key: 'validate', icon: 'checkmark-circle', label: 'Validate' },
            { key: 'export', icon: 'cloud-download', label: 'Export' },
          ] as Array<{ key: Tab; icon: string; label: string }>
        ).map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon as any}
              size={18}
              color={activeTab === tab.key ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Tab Content ── */}
      {isLoadingMeta ? (
        <Loading message="Loading metadata…" />
      ) : (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabContentInner}>
          {activeTab === 'metadata' && (
            <MetadataTab
              metadata={metadata}
              keywordsText={keywordsText}
              onChange={setMetadata}
              onKeywordsChange={setKeywordsText}
              onSave={handleSave}
              isSaving={isSaving}
            />
          )}
          {activeTab === 'format' && (
            <FormatTab
              format={format}
              pageCount={currentProject.page_count}
              onChange={setFormat}
              onSave={handleSave}
              isSaving={isSaving}
            />
          )}
          {activeTab === 'validate' && (
            <ValidateTab
              validationResult={validationResult}
              isValidating={isValidating}
              onValidate={handleValidate}
            />
          )}
          {activeTab === 'export' && (
            <ExportTab
              exportingPlatform={exportingPlatform}
              onExport={handleExport}
            />
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ── Stat chip ──────────────────────────────────────────────────────────────────

function _Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, color ? { color } : undefined]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ── Metadata Tab ───────────────────────────────────────────────────────────────

function MetadataTab({
  metadata,
  keywordsText,
  onChange,
  onKeywordsChange,
  onSave,
  isSaving,
}: {
  metadata: BookMetadata;
  keywordsText: string;
  onChange: (m: BookMetadata) => void;
  onKeywordsChange: (s: string) => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  const update = (field: keyof BookMetadata) => (value: string) =>
    onChange({ ...metadata, [field]: value });

  return (
    <>
      <Text style={styles.sectionTitle}>Book Information</Text>

      <_Field label="Title" value={metadata.title} onChangeText={update('title')} />
      <_Field label="Subtitle" value={metadata.subtitle} onChangeText={update('subtitle')} placeholder="Optional tagline" />
      <_Field label="Author Name" value={metadata.author_name} onChangeText={update('author_name')} />
      <_Field label="Pen Name" value={metadata.pen_name} onChangeText={update('pen_name')} placeholder="Optional pen name" />

      <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Series</Text>
      <_Field label="Series Name" value={metadata.series_name} onChangeText={update('series_name')} placeholder="e.g. Captain Blanket" />
      <_Field
        label="Series Number"
        value={metadata.series_number !== null ? String(metadata.series_number) : ''}
        onChangeText={(v) => onChange({ ...metadata, series_number: v ? parseInt(v, 10) || null : null })}
        keyboardType="numeric"
        placeholder="e.g. 1"
      />

      <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Publishing Details</Text>
      <_Field label="Publisher Name" value={metadata.publisher_name} onChangeText={update('publisher_name')} />
      <_Field label="Copyright Holder" value={metadata.copyright_holder} onChangeText={update('copyright_holder')} />
      <_Field label="Publication Date" value={metadata.publication_date} onChangeText={update('publication_date')} placeholder="YYYY-MM-DD" />
      <_Field label="Age Range" value={metadata.age_range} onChangeText={update('age_range')} placeholder="e.g. 3-8" />
      <_Field label="Language Code" value={metadata.language} onChangeText={update('language')} placeholder="en" />

      <Text style={styles.fieldLabel}>ISBN Status</Text>
      <View style={styles.chipRow}>
        {ISBN_STATUSES.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, metadata.isbn_status === s && styles.chipActive]}
            onPress={() => onChange({ ...metadata, isbn_status: s })}
          >
            <Text style={[styles.chipText, metadata.isbn_status === s && styles.chipTextActive]}>
              {s === 'none' ? 'No ISBN' : s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Description & Keywords</Text>
      <_Field
        label="Book Description"
        value={metadata.book_description}
        onChangeText={update('book_description')}
        multiline
        placeholder="A short description for the back cover and publishing platforms…"
        numberOfLines={5}
      />
      <_Field
        label="Keywords (comma-separated)"
        value={keywordsText}
        onChangeText={onKeywordsChange}
        placeholder="bedtime, hero, sibling, adventure"
      />

      <Button
        title={isSaving ? 'Saving…' : 'Save Metadata'}
        onPress={onSave}
        loading={isSaving}
        style={styles.saveButton}
        icon={<Ionicons name="save" size={18} color={colors.white} />}
      />
    </>
  );
}

// ── Format Tab ─────────────────────────────────────────────────────────────────

function FormatTab({
  format,
  pageCount,
  onChange,
  onSave,
  isSaving,
}: {
  format: BookFormat;
  pageCount: number;
  onChange: (f: BookFormat) => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  // Spine width: page_count × 0.002252 inches
  const PAPER_THICKNESS = 0.002252;
  const spineWidth = (pageCount * PAPER_THICKNESS).toFixed(4);

  return (
    <>
      <Text style={styles.sectionTitle}>Trim Size</Text>
      <Text style={styles.helpText}>Choose the physical print dimensions of your book.</Text>
      <View style={styles.chipRow}>
        {TRIM_SIZES.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, format.trim_size === s && styles.chipActive]}
            onPress={() => onChange({ ...format, trim_size: s })}
          >
            <Text style={[styles.chipText, format.trim_size === s && styles.chipTextActive]}>
              {s}"
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Paper & Finish</Text>

      <Text style={styles.fieldLabel}>Paper Type</Text>
      <View style={styles.chipRow}>
        {PAPER_TYPES.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.chip, format.paper_type === t && styles.chipActive]}
            onPress={() => onChange({ ...format, paper_type: t })}
          >
            <Text style={[styles.chipText, format.paper_type === t && styles.chipTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.fieldLabel}>Cover Finish</Text>
      <View style={styles.chipRow}>
        {COVER_FINISHES.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, format.cover_finish === f && styles.chipActive]}
            onPress={() => onChange({ ...format, cover_finish: f })}
          >
            <Text style={[styles.chipText, format.cover_finish === f && styles.chipTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.fieldLabel}>Interior Color</Text>
      <View style={styles.chipRow}>
        {INTERIOR_COLORS.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.chip, format.interior_color === c && styles.chipActive]}
            onPress={() => onChange({ ...format, interior_color: c })}
          >
            <Text style={[styles.chipText, format.interior_color === c && styles.chipTextActive]}>
              {c === 'bw' ? 'Black & White' : 'Full Color'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Advanced Settings</Text>

      <View style={styles.toggleRow}>
        <View style={styles.toggleInfo}>
          <Text style={styles.toggleLabel}>Bleed Margins</Text>
          <Text style={styles.toggleDesc}>0.125" bleed on all sides (required by most printers)</Text>
        </View>
        <Switch
          value={format.bleed_enabled}
          onValueChange={(v) => onChange({ ...format, bleed_enabled: v })}
          trackColor={{ false: colors.gray300, true: colors.primaryLight }}
          thumbColor={format.bleed_enabled ? colors.primary : colors.gray400}
        />
      </View>

      <View style={styles.toggleRow}>
        <View style={styles.toggleInfo}>
          <Text style={styles.toggleLabel}>Embed Fonts</Text>
          <Text style={styles.toggleDesc}>Required for PDF/X print standards</Text>
        </View>
        <Switch
          value={format.font_embedding}
          onValueChange={(v) => onChange({ ...format, font_embedding: v })}
          trackColor={{ false: colors.gray300, true: colors.primaryLight }}
          thumbColor={format.font_embedding ? colors.primary : colors.gray400}
        />
      </View>

      {/* Spine preview */}
      <Card style={styles.spineCard} variant="elevated">
        <Text style={styles.spineTitle}>📐 Spine Width Calculator</Text>
        <Text style={styles.spineFormula}>
          {pageCount} pages × {PAPER_THICKNESS}" paper = <Text style={styles.spineResult}>{spineWidth}"</Text>
        </Text>
        <Text style={styles.spineNote}>
          This value is automatically applied to your cover PDF.
        </Text>
      </Card>

      <Button
        title={isSaving ? 'Saving…' : 'Save Format Settings'}
        onPress={onSave}
        loading={isSaving}
        style={styles.saveButton}
        icon={<Ionicons name="save" size={18} color={colors.white} />}
      />
    </>
  );
}

// ── Validate Tab ───────────────────────────────────────────────────────────────

function ValidateTab({
  validationResult,
  isValidating,
  onValidate,
}: {
  validationResult: ValidationResult | null;
  isValidating: boolean;
  onValidate: () => void;
}) {
  return (
    <>
      <Text style={styles.sectionTitle}>Print Readiness Check</Text>
      <Text style={styles.helpText}>
        Run validation to check for common print issues before exporting.
      </Text>

      <Button
        title={isValidating ? 'Checking…' : 'Run Print Validation'}
        onPress={onValidate}
        loading={isValidating}
        style={{ marginBottom: spacing.lg }}
        icon={<Ionicons name="checkmark-done" size={18} color={colors.white} />}
      />

      {validationResult && (
        <>
          {/* Overall status */}
          <Card
            style={[
              styles.statusCard,
              { borderLeftColor: validationResult.ready ? colors.success : colors.error },
            ]}
          >
            <View style={styles.statusRow}>
              <Ionicons
                name={validationResult.ready ? 'checkmark-circle' : 'warning'}
                size={28}
                color={validationResult.ready ? colors.success : colors.error}
              />
              <View style={styles.statusText}>
                <Text style={styles.statusTitle}>
                  {validationResult.ready ? '✓ Ready to Export' : 'Issues Found'}
                </Text>
                <Text style={styles.statusSubtitle}>
                  {validationResult.issue_count === 0
                    ? 'All checks passed!'
                    : `${validationResult.errors.length} error(s), ${validationResult.warnings.length} warning(s)`}
                </Text>
              </View>
            </View>
          </Card>

          {/* Errors */}
          {validationResult.errors.map((issue, i) => (
            <_IssueCard key={`e-${i}`} issue={issue} />
          ))}

          {/* Warnings */}
          {validationResult.warnings.map((issue, i) => (
            <_IssueCard key={`w-${i}`} issue={issue} />
          ))}

          {validationResult.issue_count === 0 && (
            <Card style={styles.allGoodCard}>
              <Ionicons name="checkmark-circle" size={40} color={colors.success} />
              <Text style={styles.allGoodText}>All validation checks passed!</Text>
              <Text style={styles.allGoodSub}>Your book is ready to export.</Text>
            </Card>
          )}
        </>
      )}
    </>
  );
}

function _IssueCard({ issue }: { issue: ValidationIssue }) {
  const isError = issue.level === 'error';
  return (
    <Card
      style={[styles.issueCard, { borderLeftColor: isError ? colors.error : colors.warning }]}
    >
      <View style={styles.issueRow}>
        <Ionicons
          name={isError ? 'close-circle' : 'warning'}
          size={20}
          color={isError ? colors.error : colors.warning}
        />
        <View style={styles.issueText}>
          <Text style={[styles.issueBadge, { color: isError ? colors.error : colors.warning }]}>
            {isError ? 'ERROR' : 'WARNING'}
          </Text>
          <Text style={styles.issueMessage}>{issue.message}</Text>
        </View>
      </View>
    </Card>
  );
}

// ── Export Tab ─────────────────────────────────────────────────────────────────

function ExportTab({
  exportingPlatform,
  onExport,
}: {
  exportingPlatform: string | null;
  onExport: (platform: string) => void;
}) {
  return (
    <>
      <Text style={styles.sectionTitle}>Export Publishing Package</Text>
      <Text style={styles.helpText}>
        Each export contains: interior.pdf, cover.pdf, ebook.epub, metadata.json,
        and a publishing checklist. Files are bundled as a ZIP archive.
      </Text>

      {PLATFORMS.map((platform) => (
        <Card key={platform.key} style={styles.platformCard}>
          <View style={styles.platformHeader}>
            <View style={[styles.platformIcon, { backgroundColor: platform.bgColor }]}>
              <Ionicons name={platform.icon} size={26} color={platform.color} />
            </View>
            <View style={styles.platformInfo}>
              <Text style={styles.platformName}>{platform.label}</Text>
              <Text style={styles.platformDesc}>{platform.description}</Text>
            </View>
          </View>

          <Button
            title={
              exportingPlatform === platform.key
                ? 'Generating…'
                : platform.key === 'all'
                ? 'Download All Files'
                : `Export for ${platform.label}`
            }
            onPress={() => onExport(platform.key)}
            loading={exportingPlatform === platform.key}
            disabled={exportingPlatform !== null && exportingPlatform !== platform.key}
            variant={platform.key === 'all' ? 'primary' : 'outline'}
            style={styles.exportButton}
            icon={
              <Ionicons
                name="download"
                size={18}
                color={platform.key === 'all' ? colors.white : colors.primary}
              />
            }
          />
        </Card>
      ))}

      <Card style={styles.packageInfoCard} variant="elevated">
        <Text style={styles.packageInfoTitle}>📦 What's in the export package?</Text>
        {[
          { file: 'interior.pdf', desc: 'Print-ready story with title page, copyright, & all pages' },
          { file: 'cover.pdf', desc: 'Front cover + spine + back cover with calculated spine width' },
          { file: 'ebook.epub', desc: 'EPUB 3.0 — compatible with Kindle, Apple Books & Kobo' },
          { file: 'metadata.json', desc: 'All publishing metadata in structured format' },
          { file: 'publishing_checklist.txt', desc: 'Platform-specific submission guide' },
        ].map((item) => (
          <View key={item.file} style={styles.packageFileRow}>
            <Text style={styles.packageFileName}>{item.file}</Text>
            <Text style={styles.packageFileDesc}>{item.desc}</Text>
          </View>
        ))}
      </Card>
    </>
  );
}

// ── Shared Field Component ─────────────────────────────────────────────────────

function _Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  numberOfLines,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  numberOfLines?: number;
  keyboardType?: 'default' | 'numeric' | 'email-address';
}) {
  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && { height: (numberOfLines || 3) * 22 + 16, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || label}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        numberOfLines={numberOfLines}
        keyboardType={keyboardType || 'default'}
      />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgStart },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.cardBg,
    ...shadows.sm,
  },
  backButton: {
    width: 40, height: 40, borderRadius: borderRadius.full,
    backgroundColor: colors.gray100,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerText: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  headerSpacer: { width: 40 },

  // Overview
  overviewWrapper: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  overviewCard: { padding: spacing.md },
  bookTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  statLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.cardBg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
    padding: 4,
  },
  tabItem: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.sm, borderRadius: borderRadius.md, gap: 2,
  },
  tabItemActive: { backgroundColor: colors.tintPrimary },
  tabLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
  tabLabelActive: { color: colors.primary, fontWeight: '700' },

  // Content
  tabContent: { flex: 1 },
  tabContentInner: { padding: spacing.lg, paddingBottom: spacing.xxl },

  sectionTitle: {
    fontSize: 16, fontWeight: '700', color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  helpText: {
    fontSize: 13, color: colors.textSecondary, lineHeight: 20,
    marginBottom: spacing.md,
  },

  // Chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: borderRadius.full, backgroundColor: colors.gray100,
    borderWidth: 1, borderColor: colors.gray200,
  },
  chipActive: { backgroundColor: colors.tintPrimary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  chipTextActive: { color: colors.primary, fontWeight: '700' },

  // Fields
  fieldWrapper: { marginBottom: spacing.md },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 },
  fieldInput: {
    backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.gray200,
    borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    fontSize: 15, color: colors.textPrimary, ...shadows.sm,
  },

  saveButton: { marginTop: spacing.lg },

  // Toggles
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.gray100,
    marginBottom: spacing.sm,
  },
  toggleInfo: { flex: 1, marginRight: spacing.md },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  toggleDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  // Spine card
  spineCard: { padding: spacing.md, marginTop: spacing.lg, marginBottom: spacing.md },
  spineTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.xs },
  spineFormula: { fontSize: 14, color: colors.textSecondary },
  spineResult: { color: colors.primary, fontWeight: '700' },
  spineNote: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },

  // Validation
  statusCard: {
    padding: spacing.md, marginBottom: spacing.md,
    borderLeftWidth: 4, borderRadius: borderRadius.md,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusText: { flex: 1 },
  statusTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  statusSubtitle: { fontSize: 13, color: colors.textSecondary },

  issueCard: {
    padding: spacing.md, marginBottom: spacing.sm,
    borderLeftWidth: 4, borderRadius: borderRadius.md,
    backgroundColor: colors.cardBg,
  },
  issueRow: { flexDirection: 'row', gap: spacing.sm },
  issueText: { flex: 1 },
  issueBadge: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  issueMessage: { fontSize: 13, color: colors.textPrimary, marginTop: 2, lineHeight: 18 },

  allGoodCard: {
    padding: spacing.xl, alignItems: 'center', gap: spacing.sm,
    marginTop: spacing.md,
  },
  allGoodText: { fontSize: 18, fontWeight: '700', color: colors.success },
  allGoodSub: { fontSize: 14, color: colors.textSecondary },

  // Export
  platformCard: { padding: spacing.lg, marginBottom: spacing.md },
  platformHeader: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  platformIcon: {
    width: 52, height: 52, borderRadius: borderRadius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  platformInfo: { flex: 1 },
  platformName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  platformDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  exportButton: {},

  // Package info
  packageInfoCard: { padding: spacing.md, marginTop: spacing.xl },
  packageInfoTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md },
  packageFileRow: { marginBottom: spacing.sm },
  packageFileName: { fontSize: 13, fontWeight: '600', color: colors.primary, fontFamily: 'monospace' },
  packageFileDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
});
