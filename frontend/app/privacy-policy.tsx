import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../src/utils/theme';

const SECTIONS: { heading: string; body: string }[] = [
  {
    heading: 'What we collect',
    body:
      'Account info — your email and a one-way bcrypt hash of your password. We never see your plain password.\n\n' +
      'Your content — the books, characters, page text and AI-generated illustrations you create are stored under your account so you can come back to them.\n\n' +
      'Diagnostic logs — standard server logs (timestamps, request paths, error traces) used to keep the service running.',
  },
  {
    heading: 'What we do NOT collect',
    body:
      '• We do not collect location, contacts, photos, microphone or any other device data beyond what you explicitly upload.\n' +
      '• We do not sell your data, and we do not show advertising.\n' +
      '• The app is intended for adults creating books — we do not knowingly collect data from children.',
  },
  {
    heading: 'How AI generation works',
    body:
      'When you ask Rainstorms to write story text or generate an illustration, your prompt is sent to our AI providers (currently Groq, Google Gemini and Google Imagen) for processing. We do not send your account email or password to these providers. Generated text and images are returned to you and stored under your account.',
  },
  {
    heading: 'Account deletion',
    body:
      'You can permanently delete your account and all associated data at any time from Settings → Delete Account. Deletion removes your user record, all of your projects, all pages, all characters, and any related data from our database within seconds. This action is irreversible.',
  },
  {
    heading: 'Data retention',
    body:
      'Your content stays in our database for as long as your account exists. When you delete your account, your content is removed immediately. Server diagnostic logs are retained for up to 30 days.',
  },
  {
    heading: 'Children',
    body:
      'Rainstorms is designed for parents, teachers and authors. The app is not directed to children under 13 and we do not knowingly collect personal information from children.',
  },
  {
    heading: 'Contact',
    body: 'Questions about this policy? Email privacy@rainstorms.app.',
  },
];

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Privacy Policy</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.meta}>Last updated: April 2026</Text>
        <Text style={styles.intro}>
          Rainstorms helps parents and creators design illustrated children's picture books with the
          help of AI. We respect your privacy and only collect what we need to run the service.
        </Text>
        {SECTIONS.map((s) => (
          <View key={s.heading} style={styles.section}>
            <Text style={styles.heading}>{s.heading}</Text>
            <Text style={styles.body}>{s.body}</Text>
          </View>
        ))}
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
  meta: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.md },
  intro: { fontSize: 15, color: colors.textPrimary, lineHeight: 22, marginBottom: spacing.lg },
  section: { marginBottom: spacing.lg },
  heading: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.xs },
  body: { fontSize: 15, color: colors.textSecondary, lineHeight: 22 },
});
