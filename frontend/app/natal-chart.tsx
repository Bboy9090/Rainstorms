import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../src/utils/theme';
import { BASE_URL } from '../src/utils/api';

export default function NatalChartScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [birthTime, setBirthTime] = useState('');
  const [birthCity, setBirthCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isValid = name.trim() && birthDate.trim() && birthTime.trim() && birthCity.trim();

  const handleGenerate = async () => {
    if (!isValid) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/natal-chart/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          birth_date: birthDate.trim(),
          birth_time: birthTime.trim(),
          birth_city: birthCity.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail?.hint || err?.detail || 'Generation failed');
      }

      const blob = await res.blob();
      const safeName = name.replace(/\s+/g, '_');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeName}_Natal_Chart.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.bgStart, colors.bgMid, colors.bgEnd]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cosmic Reading</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.iconRing}>
            <Ionicons name="planet" size={42} color={colors.primary} />
          </View>
          <Text style={styles.heroTitle}>Natal Chart{'\n'}+ Human Design</Text>
          <Text style={styles.heroSub}>
            Enter birth details to receive a personalised astrological profile and Human Design reading, delivered as a beautifully formatted PDF.
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Field
            label="Full Name"
            placeholder="e.g. Bobby"
            value={name}
            onChangeText={setName}
            icon="person-outline"
          />
          <Field
            label="Birth Date"
            placeholder="e.g. September 17, 1990"
            value={birthDate}
            onChangeText={setBirthDate}
            icon="calendar-outline"
          />
          <Field
            label="Birth Time"
            placeholder="e.g. 11:11 AM"
            value={birthTime}
            onChangeText={setBirthTime}
            icon="time-outline"
          />
          <Field
            label="Birth City"
            placeholder="e.g. Bronx, New York, USA"
            value={birthCity}
            onChangeText={setBirthCity}
            icon="location-outline"
          />

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color="#F87171" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.generateBtn, (!isValid || loading) && styles.generateBtnDisabled]}
            onPress={handleGenerate}
            disabled={!isValid || loading}
          >
            <LinearGradient
              colors={isValid && !loading
                ? ['rgba(56,189,248,0.9)', 'rgba(99,102,241,0.9)']
                : ['rgba(100,100,100,0.3)', 'rgba(100,100,100,0.3)']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Ionicons name="download-outline" size={20} color="#fff" />
            )}
            <Text style={styles.generateBtnText}>
              {loading ? 'Generating your reading…' : 'Generate & Download PDF'}
            </Text>
          </TouchableOpacity>

          {loading && (
            <Text style={styles.loadingNote}>
              This takes 20–40 seconds — the AI is crafting your full reading.
            </Text>
          )}
        </View>

        {/* Info cards */}
        <View style={styles.infoRow}>
          <InfoCard icon="star-outline" title="Natal Chart" desc="Planetary placements, aspects, and chart themes." />
          <InfoCard icon="sparkles-outline" title="Human Design" desc="Type, Strategy, Authority, Profile, and more." />
        </View>

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            Readings are generated by AI based on your birth data. Treat them as a reflective tool, not predictive fact.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Field({ label, placeholder, value, onChangeText, icon }: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  icon: string;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldRow}>
        <Ionicons name={icon as any} size={18} color={colors.textSecondary} style={styles.fieldIcon} />
        <TextInput
          style={styles.fieldInput}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted ?? 'rgba(255,255,255,0.3)'}
          value={value}
          onChangeText={onChangeText}
        />
      </View>
    </View>
  );
}

function InfoCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <View style={styles.infoCard}>
      <Ionicons name={icon as any} size={24} color={colors.primary} />
      <Text style={styles.infoCardTitle}>{title}</Text>
      <Text style={styles.infoCardDesc}>{desc}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgStart },
  content: { paddingBottom: 60 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: 52,
    paddingBottom: spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  iconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(56,189,248,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 34,
    marginBottom: spacing.md,
  },
  heroSub: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.8,
    maxWidth: 320,
  },
  form: {
    marginHorizontal: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: spacing.lg,
    gap: spacing.md,
  },
  fieldWrap: { gap: 6 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: spacing.md,
    height: 48,
  },
  fieldIcon: { marginRight: spacing.sm },
  fieldInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    height: 48,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
  },
  errorText: { fontSize: 13, color: '#F87171', flex: 1 },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 56,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  generateBtnDisabled: { opacity: 0.5 },
  generateBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  loadingNote: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    opacity: 0.7,
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  infoCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: spacing.md,
    alignItems: 'center',
    gap: 6,
  },
  infoCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  infoCardDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    opacity: 0.75,
    lineHeight: 17,
  },
  disclaimer: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  disclaimerText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    opacity: 0.5,
    lineHeight: 17,
  },
});
