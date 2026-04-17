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
import { colors, spacing, borderRadius, shadows } from '../src/utils/theme';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Input } from '../src/components/Input';
import { useAuth } from '../src/context/AuthContext';
import { formatApiError } from '../src/utils/api';

const APP_VERSION = '1.1.0';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout, deleteAccount } = useAuth();

  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleSignOut = async () => {
    if (Platform.OS === 'web') {
      await logout();
      router.replace('/auth');
      return;
    }
    Alert.alert('Sign Out', 'Sign out of your account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/auth');
        },
      },
    ]);
  };

  const handleDeleteAccount = async () => {
    setDeleteError('');
    if (confirmText.trim() !== 'DELETE') {
      setDeleteError('Please type DELETE (in capital letters) to confirm.');
      return;
    }
    setIsDeleting(true);
    try {
      await deleteAccount();
      router.replace('/auth');
    } catch (err: any) {
      setDeleteError(formatApiError(err, 'Failed to delete account.'));
    } finally {
      setIsDeleting(false);
    }
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Settings</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="person-outline" size={48} color={colors.gray300} />
          <Text style={styles.emptyText}>Sign in to manage your account.</Text>
          <Button title="Sign In" onPress={() => router.replace('/auth')} style={{ marginTop: spacing.md }} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Account */}
        <Text style={styles.sectionLabel}>Account</Text>
        <Card style={styles.card} variant="elevated">
          <View style={styles.row}>
            <Ionicons name="mail-outline" size={20} color={colors.textMuted} />
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>Email</Text>
              <Text style={styles.rowValue}>{user.email}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={20} color={colors.textPrimary} />
            <Text style={[styles.rowLabel, { flex: 1, marginLeft: spacing.sm }]}>Sign Out</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </Card>

        {/* Legal */}
        <Text style={styles.sectionLabel}>Legal</Text>
        <Card style={styles.card} variant="elevated">
          <TouchableOpacity style={styles.row} onPress={() => router.push('/privacy-policy')}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.textPrimary} />
            <Text style={[styles.rowLabel, { flex: 1, marginLeft: spacing.sm }]}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={() => router.push('/terms')}>
            <Ionicons name="document-text-outline" size={20} color={colors.textPrimary} />
            <Text style={[styles.rowLabel, { flex: 1, marginLeft: spacing.sm }]}>Terms of Service</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </Card>

        {/* Danger Zone */}
        <Text style={[styles.sectionLabel, { color: colors.error }]}>Danger Zone</Text>
        <Card style={[styles.card, styles.dangerCard]} variant="elevated">
          {!showDeleteConfirm ? (
            <TouchableOpacity style={styles.row} onPress={() => setShowDeleteConfirm(true)}>
              <Ionicons name="trash-outline" size={20} color={colors.error} />
              <Text style={[styles.rowLabel, { flex: 1, marginLeft: spacing.sm, color: colors.error }]}>
                Delete Account
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.error} />
            </TouchableOpacity>
          ) : (
            <View>
              <Text style={styles.dangerText}>
                This permanently deletes your account, every project, every page and every character.
                This cannot be undone.
              </Text>
              <Text style={styles.dangerHint}>Type DELETE below to confirm:</Text>
              <Input
                placeholder="DELETE"
                value={confirmText}
                onChangeText={(t) => {
                  setConfirmText(t);
                  if (deleteError) setDeleteError('');
                }}
                autoCapitalize="characters"
              />
              {deleteError ? (
                <Text style={styles.dangerError}>{deleteError}</Text>
              ) : null}
              <View style={styles.dangerActions}>
                <Button
                  title="Cancel"
                  variant="ghost"
                  onPress={() => {
                    setShowDeleteConfirm(false);
                    setConfirmText('');
                  }}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Delete Forever"
                  onPress={handleDeleteAccount}
                  loading={isDeleting}
                  style={{ flex: 1, backgroundColor: colors.error }}
                />
              </View>
            </View>
          )}
        </Card>

        <Text style={styles.versionText}>Rainstorms v{APP_VERSION}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgStart },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
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
  title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  card: { padding: 0, overflow: 'hidden' },
  dangerCard: { borderColor: colors.error + '55', borderWidth: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15, color: colors.textPrimary, fontWeight: '500' },
  rowValue: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.cardBorder, marginHorizontal: spacing.md },
  dangerText: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, padding: spacing.md, paddingBottom: 0 },
  dangerHint: { fontSize: 13, color: colors.textMuted, paddingHorizontal: spacing.md, marginTop: spacing.sm, marginBottom: spacing.xs },
  dangerActions: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, paddingTop: 0 },
  dangerError: {
    fontSize: 13,
    color: colors.error,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  versionText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyText: { fontSize: 14, color: colors.textMuted, marginTop: spacing.sm },
});
