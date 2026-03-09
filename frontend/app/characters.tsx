import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../src/utils/theme';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Loading } from '../src/components/Loading';
import { SaveIndicator } from '../src/components/SaveIndicator';
import { useProject, Character } from '../src/context/ProjectContext';
import { api, buildImageUrl } from '../src/utils/api';

// ── Helpers ─────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  main: colors.primary,
  supporting: colors.secondary,
  minor: colors.accent,
};

function getRoleColor(role: string): string {
  return ROLE_COLORS[role.toLowerCase()] ?? colors.gray500;
}

const EMPTY_NEW_CHAR = {
  name: '',
  role: 'supporting',
  personality: '',
  appearance: '',
  special_trait: '',
  notes: '',
  color_palette: '',
  clothing: '',
  unique_traits: '',
};

// ── Screen ───────────────────────────────────────────────────────────────────

export default function CharactersScreen() {
  const router = useRouter();
  const {
    currentProject,
    characters,
    setCharacters,
    updateCharacter,
    saveStatus,
    lastSaved,
    isLoading,
    setError,
  } = useProject();

  const [isGenerating, setIsGenerating] = useState(false);
  const [editingChar, setEditingChar] = useState<Character | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newChar, setNewChar] = useState(EMPTY_NEW_CHAR);
  // Per-character loading state for reference sheet and lock actions
  const [generatingRefSheet, setGeneratingRefSheet] = useState<string | null>(null);
  const [togglingLock, setTogglingLock] = useState<string | null>(null);

  if (isLoading || !currentProject) {
    return <Loading message="Loading characters..." fullScreen />;
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleGenerateCharacters = async () => {
    setIsGenerating(true);
    try {
      const response = await api.post(`/generate/characters?project_id=${currentProject.id}`);
      setCharacters(response.data);
    } catch {
      setError('Failed to generate characters');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEditField = (field: keyof Character, value: string) => {
    if (editingChar) {
      setEditingChar({ ...editingChar, [field]: value });
    }
  };

  const handleSaveCharacter = async () => {
    if (!editingChar) return;
    updateCharacter(editingChar.id, {
      name: editingChar.name,
      role: editingChar.role,
      personality: editingChar.personality,
      appearance: editingChar.appearance,
      special_trait: editingChar.special_trait,
      notes: editingChar.notes,
      color_palette: editingChar.color_palette,
      clothing: editingChar.clothing,
      unique_traits: editingChar.unique_traits,
    });
    setEditingChar(null);
  };

  const handleAddCharacter = async () => {
    try {
      const response = await api.post(`/projects/${currentProject.id}/characters`, newChar);
      setCharacters([...characters, response.data]);
      setShowAddModal(false);
      setNewChar(EMPTY_NEW_CHAR);
    } catch {
      setError('Failed to add character');
    }
  };

  const handleDeleteCharacter = async (charId: string) => {
    try {
      await api.delete(`/characters/${charId}`);
      setCharacters(characters.filter((c) => c.id !== charId));
    } catch {
      setError('Failed to delete character');
    }
  };

  const handleGenerateReferenceSheet = useCallback(async (char: Character) => {
    if (!char.appearance && !char.color_palette && !char.unique_traits) {
      Alert.alert(
        'No Visual Profile',
        'Fill in Appearance, Color Palette, or Unique Traits before generating a reference sheet.'
      );
      return;
    }
    setGeneratingRefSheet(char.id);
    try {
      const res = await api.post(`/characters/${char.id}/reference-sheet`);
      updateCharacter(char.id, { reference_sheet_url: res.data.reference_sheet_url });
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to generate reference sheet.';
      Alert.alert('Generation Failed', msg);
    } finally {
      setGeneratingRefSheet(null);
    }
  }, [updateCharacter]);

  const handleToggleLock = useCallback(async (char: Character) => {
    setTogglingLock(char.id);
    try {
      const endpoint = char.appearance_locked
        ? `/characters/${char.id}/unlock`
        : `/characters/${char.id}/lock`;
      await api.post(endpoint);
      updateCharacter(char.id, { appearance_locked: !char.appearance_locked });
    } catch {
      Alert.alert('Error', 'Failed to update appearance lock.');
    } finally {
      setTogglingLock(null);
    }
  }, [updateCharacter]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerTitle}>
            <Ionicons name="people" size={24} color={colors.primary} />
            <Text style={styles.title}>Character Forge</Text>
          </View>
          <SaveIndicator status={saveStatus} lastSaved={lastSaved} />
        </View>
        <View style={{ width: 40 }} />
      </View>

      <Text style={styles.subtitle}>
        Build your cast. Visual profiles keep characters consistent across every illustration.
      </Text>

      {/* Actions */}
      <View style={styles.topActions}>
        <Button
          title={characters.length > 0 ? 'Regenerate All' : 'Generate Characters'}
          onPress={handleGenerateCharacters}
          variant={characters.length > 0 ? 'outline' : 'primary'}
          size="md"
          loading={isGenerating}
          icon={<Ionicons name="sparkles" size={18} color={characters.length > 0 ? colors.primary : colors.white} />}
        />
        <Button
          title="Add Character"
          onPress={() => setShowAddModal(true)}
          variant="outline"
          size="md"
          icon={<Ionicons name="add" size={18} color={colors.primary} />}
        />
      </View>

      {/* Character Cards */}
      {isGenerating ? (
        <Loading message="Creating characters..." />
      ) : characters.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Ionicons name="people-outline" size={48} color={colors.gray300} />
          <Text style={styles.emptyText}>No characters yet</Text>
          <Text style={styles.emptySubtext}>
            Generate characters based on your story blueprint
          </Text>
        </Card>
      ) : (
        <View style={styles.characterGrid}>
          {characters.map((char) => (
            <Card key={char.id} style={styles.characterCard} variant="elevated">
              {/* Card Header */}
              <View style={styles.cardHeader}>
                <View style={styles.charInfo}>
                  <View style={styles.charNameRow}>
                    <Text style={styles.charName}>{char.name}</Text>
                    {char.appearance_locked && (
                      <View style={styles.lockBadge}>
                        <Ionicons name="lock-closed" size={11} color={colors.white} />
                        <Text style={styles.lockBadgeText}>Locked</Text>
                      </View>
                    )}
                  </View>
                  <View style={[styles.roleBadge, { backgroundColor: getRoleColor(char.role) }]}>
                    <Text style={styles.roleText}>{char.role}</Text>
                  </View>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.cardButton}
                    onPress={() => setEditingChar(char)}
                  >
                    <Ionicons name="pencil" size={16} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cardButton}
                    onPress={() => handleDeleteCharacter(char.id)}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Reference Sheet Image */}
              {char.reference_sheet_url ? (
                <Image
                  source={{ uri: buildImageUrl(char.reference_sheet_url) }}
                  style={styles.referenceSheetImage}
                  resizeMode="cover"
                />
              ) : generatingRefSheet === char.id ? (
                <View style={styles.refSheetGenerating}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.refSheetGeneratingText}>Generating reference sheet…</Text>
                </View>
              ) : null}

              {/* Visual Profile Fields */}
              <View style={styles.charField}>
                <Text style={styles.fieldLabel}>Appearance</Text>
                <Text style={styles.fieldValue}>{char.appearance}</Text>
              </View>

              {char.color_palette ? (
                <View style={styles.charField}>
                  <Text style={styles.fieldLabel}>Color Palette</Text>
                  <Text style={styles.fieldValue}>{char.color_palette}</Text>
                </View>
              ) : null}

              {char.clothing ? (
                <View style={styles.charField}>
                  <Text style={styles.fieldLabel}>Clothing</Text>
                  <Text style={styles.fieldValue}>{char.clothing}</Text>
                </View>
              ) : null}

              {char.unique_traits ? (
                <View style={styles.charField}>
                  <Text style={styles.fieldLabel}>Unique Traits</Text>
                  <Text style={styles.specialTrait}>{char.unique_traits}</Text>
                </View>
              ) : null}

              <View style={styles.charField}>
                <Text style={styles.fieldLabel}>Personality</Text>
                <Text style={styles.fieldValue}>{char.personality}</Text>
              </View>

              {char.notes ? (
                <View style={styles.charField}>
                  <Text style={styles.fieldLabel}>Notes</Text>
                  <Text style={styles.fieldValue}>{char.notes}</Text>
                </View>
              ) : null}

              {/* Consistency Engine Actions */}
              <View style={styles.charActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, generatingRefSheet === char.id && styles.actionBtnDisabled]}
                  onPress={() => handleGenerateReferenceSheet(char)}
                  disabled={generatingRefSheet === char.id}
                >
                  <Ionicons
                    name="image-outline"
                    size={14}
                    color={generatingRefSheet === char.id ? colors.gray400 : colors.primary}
                  />
                  <Text style={[styles.actionBtnText, generatingRefSheet === char.id && { color: colors.gray400 }]}>
                    {char.reference_sheet_url ? 'Regenerate Sheet' : 'Generate Sheet'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    char.appearance_locked && styles.actionBtnLocked,
                    togglingLock === char.id && styles.actionBtnDisabled,
                  ]}
                  onPress={() => handleToggleLock(char)}
                  disabled={togglingLock === char.id}
                >
                  <Ionicons
                    name={char.appearance_locked ? 'lock-closed' : 'lock-open-outline'}
                    size={14}
                    color={char.appearance_locked ? colors.white : colors.primary}
                  />
                  <Text style={[styles.actionBtnText, char.appearance_locked && { color: colors.white }]}>
                    {char.appearance_locked ? 'Locked' : 'Lock Appearance'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))}
        </View>
      )}

      {/* Continue Buttons */}
      {characters.length > 0 && (
        <View style={styles.bottomActions}>
          <Button
            title="Story Memory"
            onPress={() => router.push('/story-memory')}
            variant="outline"
            size="md"
            icon={<Ionicons name="brain" size={18} color={colors.primary} />}
            style={styles.memoryButton}
          />
          <Button
            title="Continue to Page Builder"
            onPress={() => router.push('/page-builder')}
            size="lg"
            icon={<Ionicons name="arrow-forward" size={22} color={colors.white} />}
            style={styles.continueButton}
          />
        </View>
      )}

      {/* ── Edit Character Modal ── */}
      <Modal visible={!!editingChar} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setEditingChar(null)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Character</Text>
              <TouchableOpacity onPress={() => setEditingChar(null)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {editingChar && (
              <ScrollView style={styles.modalScroll}>
                <ModalField label="Name" value={editingChar.name} onChangeText={(v) => handleEditField('name', v)} />
                <ModalField label="Role" value={editingChar.role} onChangeText={(v) => handleEditField('role', v)} placeholder="main, supporting, or minor" />
                <ModalField label="Personality" value={editingChar.personality} onChangeText={(v) => handleEditField('personality', v)} multiline />
                <ModalField label="Appearance" value={editingChar.appearance} onChangeText={(v) => handleEditField('appearance', v)} multiline />

                <Text style={styles.sectionSeparatorLabel}>Visual Profile (for illustration consistency)</Text>

                <ModalField label="Color Palette" value={editingChar.color_palette} onChangeText={(v) => handleEditField('color_palette', v)} placeholder="e.g. deep blue, silver, warm gold" />
                <ModalField label="Clothing" value={editingChar.clothing} onChangeText={(v) => handleEditField('clothing', v)} multiline placeholder="e.g. flowing quilt cape with star patterns" />
                <ModalField label="Unique Traits" value={editingChar.unique_traits} onChangeText={(v) => handleEditField('unique_traits', v)} multiline placeholder="e.g. glowing star eyes, stitched seams visible" />
                <ModalField label="Special Trait" value={editingChar.special_trait} onChangeText={(v) => handleEditField('special_trait', v)} />
                <ModalField label="Notes" value={editingChar.notes} onChangeText={(v) => handleEditField('notes', v)} multiline />

                <Button title="Save Changes" onPress={handleSaveCharacter} style={styles.modalButton} />
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Add Character Modal ── */}
      <Modal visible={showAddModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowAddModal(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Character</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <ModalField label="Name *" value={newChar.name} onChangeText={(v) => setNewChar({ ...newChar, name: v })} placeholder="Character name" />
              <ModalField label="Role" value={newChar.role} onChangeText={(v) => setNewChar({ ...newChar, role: v })} placeholder="main, supporting, or minor" />
              <ModalField label="Personality" value={newChar.personality} onChangeText={(v) => setNewChar({ ...newChar, personality: v })} multiline placeholder="Describe their personality" />
              <ModalField label="Appearance" value={newChar.appearance} onChangeText={(v) => setNewChar({ ...newChar, appearance: v })} multiline placeholder="Visual description for illustrations" />

              <Text style={styles.sectionSeparatorLabel}>Visual Profile</Text>

              <ModalField label="Color Palette" value={newChar.color_palette} onChangeText={(v) => setNewChar({ ...newChar, color_palette: v })} placeholder="e.g. deep blue, silver, warm gold" />
              <ModalField label="Clothing" value={newChar.clothing} onChangeText={(v) => setNewChar({ ...newChar, clothing: v })} multiline placeholder="e.g. flowing quilt cape" />
              <ModalField label="Unique Traits" value={newChar.unique_traits} onChangeText={(v) => setNewChar({ ...newChar, unique_traits: v })} multiline placeholder="e.g. glowing star eyes" />
              <ModalField label="Special Trait" value={newChar.special_trait} onChangeText={(v) => setNewChar({ ...newChar, special_trait: v })} placeholder="What makes them unique" />

              <Button
                title="Add Character"
                onPress={handleAddCharacter}
                disabled={!newChar.name.trim()}
                style={styles.modalButton}
              />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

// ── Reusable modal field ──────────────────────────────────────────────────────

function ModalField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multilineInput]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.gray400}
        multiline={multiline}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgStart },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  backButton: {
    width: 40, height: 40, borderRadius: borderRadius.full,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
    ...shadows.sm,
  },
  headerCenter: { flex: 1, alignItems: 'center', gap: spacing.xs },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },

  topActions: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md, marginBottom: spacing.lg },

  characterGrid: { gap: spacing.md },
  characterCard: { padding: spacing.lg },

  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  charInfo: { flex: 1 },
  charNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.xs },
  charName: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  lockBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.primary, borderRadius: borderRadius.full,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  lockBadgeText: { fontSize: 11, fontWeight: '700', color: colors.white },
  roleBadge: {
    paddingVertical: 2, paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full, alignSelf: 'flex-start',
  },
  roleText: { fontSize: 12, fontWeight: '600', color: colors.white, textTransform: 'capitalize' },
  cardActions: { flexDirection: 'row', gap: spacing.sm },
  cardButton: {
    width: 32, height: 32, borderRadius: borderRadius.full,
    backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center',
  },

  referenceSheetImage: {
    width: '100%', height: 200, borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  refSheetGenerating: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    justifyContent: 'center', paddingVertical: spacing.md,
    backgroundColor: '#EEF2FF', borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  refSheetGeneratingText: { fontSize: 13, color: colors.primary, fontWeight: '500' },

  charField: { marginBottom: spacing.sm },
  fieldLabel: {
    fontSize: 11, fontWeight: '600', color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2,
  },
  fieldValue: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  specialTrait: { fontSize: 14, color: colors.primary, fontWeight: '500', lineHeight: 20 },

  charActions: {
    flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md,
    paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.gray200,
    flexWrap: 'wrap',
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  actionBtnLocked: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { fontSize: 12, color: colors.primary, fontWeight: '600' },

  emptyCard: { padding: spacing.xxl, alignItems: 'center' },
  emptyText: { fontSize: 18, fontWeight: '600', color: colors.textSecondary, marginTop: spacing.md },
  emptySubtext: { fontSize: 14, color: colors.textMuted, marginTop: spacing.xs },

  bottomActions: { marginTop: spacing.xl, alignItems: 'center' },
  continueButton: { width: '100%', maxWidth: 320 },
  memoryButton: { marginBottom: spacing.md },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.white, borderRadius: borderRadius.lg,
    width: '100%', maxWidth: 500, maxHeight: '90%', ...shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.gray200,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  modalScroll: { padding: spacing.lg },
  sectionSeparatorLabel: {
    fontSize: 12, fontWeight: '700', color: colors.primary,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: spacing.md, marginBottom: spacing.sm,
    paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#EEF2FF',
  },
  inputGroup: { marginBottom: spacing.md },
  inputLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.gray100, borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    fontSize: 16, color: colors.textPrimary,
  },
  multilineInput: { minHeight: 72, textAlignVertical: 'top' },
  modalButton: { marginTop: spacing.md },
});


export default function CharactersScreen() {
  const router = useRouter();
  const { 
    currentProject, 
    characters, 
    setCharacters, 
    updateCharacter,
    saveStatus,
    lastSaved,
    isLoading, 
    setError 
  } = useProject();
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingChar, setEditingChar] = useState<Character | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newChar, setNewChar] = useState({
    name: '',
    role: 'supporting',
    personality: '',
    appearance: '',
    special_trait: '',
    notes: '',
  });

  if (isLoading || !currentProject) {
    return <Loading message="Loading characters..." fullScreen />;
  }

  const handleGenerateCharacters = async () => {
    setIsGenerating(true);
    try {
      const response = await api.post(`/generate/characters?project_id=${currentProject.id}`);
      setCharacters(response.data);
    } catch (err: any) {
      setError('Failed to generate characters');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEditField = (field: keyof Character, value: string) => {
    if (editingChar) {
      setEditingChar({ ...editingChar, [field]: value });
    }
  };

  const handleSaveCharacter = async () => {
    if (!editingChar) return;
    // Use updateCharacter for autosave
    updateCharacter(editingChar.id, {
      name: editingChar.name,
      role: editingChar.role,
      personality: editingChar.personality,
      appearance: editingChar.appearance,
      special_trait: editingChar.special_trait,
      notes: editingChar.notes,
    });
    setEditingChar(null);
  };

  const handleAddCharacter = async () => {
    try {
      const response = await api.post(`/projects/${currentProject.id}/characters`, newChar);
      setCharacters([...characters, response.data]);
      setShowAddModal(false);
      setNewChar({
        name: '',
        role: 'supporting',
        personality: '',
        appearance: '',
        special_trait: '',
        notes: '',
      });
    } catch (err) {
      setError('Failed to add character');
    }
  };

  const handleDeleteCharacter = async (charId: string) => {
    try {
      await api.delete(`/characters/${charId}`);
      setCharacters(characters.filter((c) => c.id !== charId));
    } catch (err) {
      setError('Failed to delete character');
    }
  };

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'main':
        return colors.primary;
      case 'supporting':
        return colors.secondary;
      default:
        return colors.gray500;
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerTitle}>
            <Ionicons name="people" size={24} color={colors.primary} />
            <Text style={styles.title}>Character Forge</Text>
          </View>
          <SaveIndicator status={saveStatus} lastSaved={lastSaved} />
        </View>
        <View style={{ width: 40 }} />
      </View>

      <Text style={styles.subtitle}>
        Meet your characters! Edit their details or generate new ones.
      </Text>

      {/* Actions */}
      <View style={styles.topActions}>
        <Button
          title={characters.length > 0 ? 'Regenerate All' : 'Generate Characters'}
          onPress={handleGenerateCharacters}
          variant={characters.length > 0 ? 'outline' : 'primary'}
          size="md"
          loading={isGenerating}
          icon={<Ionicons name="sparkles" size={18} color={characters.length > 0 ? colors.primary : colors.white} />}
        />
        <Button
          title="Add Character"
          onPress={() => setShowAddModal(true)}
          variant="outline"
          size="md"
          icon={<Ionicons name="add" size={18} color={colors.primary} />}
        />
      </View>

      {/* Character Cards */}
      {isGenerating ? (
        <Loading message="Creating characters..." />
      ) : characters.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Ionicons name="people-outline" size={48} color={colors.gray300} />
          <Text style={styles.emptyText}>No characters yet</Text>
          <Text style={styles.emptySubtext}>
            Generate characters based on your story blueprint
          </Text>
        </Card>
      ) : (
        <View style={styles.characterGrid}>
          {characters.map((char) => (
            <Card key={char.id} style={styles.characterCard} variant="elevated">
              <View style={styles.cardHeader}>
                <View style={styles.charInfo}>
                  <Text style={styles.charName}>{char.name}</Text>
                  <View style={[styles.roleBadge, { backgroundColor: getRoleColor(char.role) }]}>
                    <Text style={styles.roleText}>{char.role}</Text>
                  </View>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.cardButton}
                    onPress={() => setEditingChar(char)}
                  >
                    <Ionicons name="pencil" size={16} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cardButton}
                    onPress={() => handleDeleteCharacter(char.id)}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.charField}>
                <Text style={styles.fieldLabel}>Personality</Text>
                <Text style={styles.fieldValue}>{char.personality}</Text>
              </View>

              <View style={styles.charField}>
                <Text style={styles.fieldLabel}>Appearance</Text>
                <Text style={styles.fieldValue}>{char.appearance}</Text>
              </View>

              <View style={styles.charField}>
                <Text style={styles.fieldLabel}>Special Trait</Text>
                <Text style={styles.specialTrait}>{char.special_trait}</Text>
              </View>

              {char.notes && (
                <View style={styles.charField}>
                  <Text style={styles.fieldLabel}>Notes</Text>
                  <Text style={styles.fieldValue}>{char.notes}</Text>
                </View>
              )}
            </Card>
          ))}
        </View>
      )}

      {/* Continue Button */}
      {characters.length > 0 && (
        <View style={styles.bottomActions}>
          <Button
            title="Story Memory"
            onPress={() => router.push('/story-memory')}
            variant="outline"
            size="md"
            icon={<Ionicons name="brain" size={18} color={colors.primary} />}
            style={styles.memoryButton}
          />
          <Button
            title="Continue to Page Builder"
            onPress={() => router.push('/page-builder')}
            size="lg"
            icon={<Ionicons name="arrow-forward" size={22} color={colors.white} />}
            style={styles.continueButton}
          />
        </View>
      )}

      {/* Edit Character Modal */}
      <Modal visible={!!editingChar} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setEditingChar(null)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Character</Text>
              <TouchableOpacity onPress={() => setEditingChar(null)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {editingChar && (
              <ScrollView style={styles.modalScroll}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Name</Text>
                  <TextInput
                    style={styles.input}
                    value={editingChar.name}
                    onChangeText={(text) => handleEditField('name', text)}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Role</Text>
                  <TextInput
                    style={styles.input}
                    value={editingChar.role}
                    onChangeText={(text) => handleEditField('role', text)}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Personality</Text>
                  <TextInput
                    style={[styles.input, styles.multilineInput]}
                    value={editingChar.personality}
                    onChangeText={(text) => handleEditField('personality', text)}
                    multiline
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Appearance</Text>
                  <TextInput
                    style={[styles.input, styles.multilineInput]}
                    value={editingChar.appearance}
                    onChangeText={(text) => handleEditField('appearance', text)}
                    multiline
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Special Trait</Text>
                  <TextInput
                    style={styles.input}
                    value={editingChar.special_trait}
                    onChangeText={(text) => handleEditField('special_trait', text)}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Notes</Text>
                  <TextInput
                    style={[styles.input, styles.multilineInput]}
                    value={editingChar.notes}
                    onChangeText={(text) => handleEditField('notes', text)}
                    multiline
                  />
                </View>

                <Button
                  title="Save Changes"
                  onPress={handleSaveCharacter}
                  style={styles.modalButton}
                />
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add Character Modal */}
      <Modal visible={showAddModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowAddModal(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Character</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Name</Text>
                <TextInput
                  style={styles.input}
                  value={newChar.name}
                  onChangeText={(text) => setNewChar({ ...newChar, name: text })}
                  placeholder="Character name"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Role</Text>
                <TextInput
                  style={styles.input}
                  value={newChar.role}
                  onChangeText={(text) => setNewChar({ ...newChar, role: text })}
                  placeholder="main, supporting, or minor"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Personality</Text>
                <TextInput
                  style={[styles.input, styles.multilineInput]}
                  value={newChar.personality}
                  onChangeText={(text) => setNewChar({ ...newChar, personality: text })}
                  multiline
                  placeholder="Describe their personality"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Appearance</Text>
                <TextInput
                  style={[styles.input, styles.multilineInput]}
                  value={newChar.appearance}
                  onChangeText={(text) => setNewChar({ ...newChar, appearance: text })}
                  multiline
                  placeholder="Visual description for illustration"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Special Trait</Text>
                <TextInput
                  style={styles.input}
                  value={newChar.special_trait}
                  onChangeText={(text) => setNewChar({ ...newChar, special_trait: text })}
                  placeholder="What makes them unique"
                />
              </View>

              <Button
                title="Add Character"
                onPress={handleAddCharacter}
                disabled={!newChar.name.trim()}
                style={styles.modalButton}
              />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  topActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  characterGrid: {
    gap: spacing.md,
  },
  characterCard: {
    padding: spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  charInfo: {
    flex: 1,
  },
  charName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  roleBadge: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
    textTransform: 'capitalize',
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cardButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  charField: {
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  specialTrait: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
    lineHeight: 20,
  },
  emptyCard: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  bottomActions: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  continueButton: {
    width: '100%',
    maxWidth: 320,
  },
  memoryButton: {
    marginBottom: spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    ...shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalScroll: {
    padding: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.gray100,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.textPrimary,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalButton: {
    marginTop: spacing.md,
  },
});
