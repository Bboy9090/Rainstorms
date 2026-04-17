import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../src/utils/theme';

const SECTIONS: { heading: string; body: string }[] = [
  {
    heading: 'Your account',
    body:
      "You're responsible for keeping your login credentials safe and for all activity under your account. You must be at least 13 years old (or the age of digital consent in your country) to create an account.",
  },
  {
    heading: 'Your content',
    body:
      'You own the books, characters and AI-generated illustrations you create inside Rainstorms. By using the AI generation features you confirm that your prompts do not violate any law or third-party right.',
  },
  {
    heading: 'Acceptable use',
    body:
      'You agree not to use Rainstorms to generate content that is unlawful, sexually explicit, hateful, violent towards real people, or that targets, exploits or endangers minors. We may suspend or remove accounts that violate these rules.',
  },
  {
    heading: 'AI-generated output',
    body:
      'AI models can occasionally produce inaccurate, biased or surprising text and images. You are responsible for reviewing AI output before publishing or distributing any book made with Rainstorms.',
  },
  {
    heading: 'Service availability',
    body:
      'We try hard to keep Rainstorms online but we don\'t guarantee uninterrupted service. The app is provided "as is" without warranties of any kind, to the maximum extent allowed by law.',
  },
  {
    heading: 'Termination',
    body:
      'You can delete your account at any time from Settings → Delete Account. We may terminate accounts that violate these Terms.',
  },
  {
    heading: 'Contact',
    body: 'Questions? Email support@rainstorms.app.',
  },
];

export default function TermsScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Terms of Service</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.meta}>Last updated: April 2026</Text>
        <Text style={styles.intro}>By using Rainstorms you agree to these Terms.</Text>
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
