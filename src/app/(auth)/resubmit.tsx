import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, typography } from '@/constants/theme';
import {
  fetchOnboardingStatus,
  hrefForOnboardingStep,
  IncompleteStep,
  OnboardingStatus,
  routeAfterAuthenticatedSession,
} from '@/lib/onboarding-routing';
import { getSessionToken } from '@/lib/session';

const logo = require('@/assets/images/login/logo.png');

const STEP_LABELS: Record<IncompleteStep, string> = {
  'business-details': 'Business Details',
  documents: 'Documents',
  'bank-details': 'Bank Details',
};

export default function ResubmitScreen() {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadStatus() {
    setLoading(true);
    setError(null);

    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Your session expired. Please log in again.');

      const nextStatus = await fetchOnboardingStatus(token);
      if (nextStatus.phase !== 'rejected') {
        await routeAfterAuthenticatedSession(token);
        return;
      }

      setStatus(nextStatus);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load your application status.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  function editSection() {
    const step = status?.nextIncompleteStep ?? 'bank-details';
    router.push(hrefForOnboardingStep(step));
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.stateText}>Loading your review details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !status) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>Couldn&apos;t load your application</Text>
          <Text style={styles.stateText}>
            {error || 'Please try again to view the latest review details.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={loadStatus}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const step = status.nextIncompleteStep ?? 'bank-details';
  const stepLabel = STEP_LABELS[step];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={styles.backButton}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <View style={styles.headerBrand}>
            <Image source={logo} style={styles.logo} contentFit="contain" />
            <Text style={styles.headerTitle}>Application Review</Text>
          </View>
        </View>

        <View style={styles.alertIcon}>
          <Text style={styles.alertMark}>!</Text>
        </View>
        <Text style={styles.title}>Action needed</Text>
        <Text style={styles.body}>
          Your application needs an update before our admin team can approve it.
        </Text>

        <View style={styles.reasonCard}>
          <Text style={styles.reasonLabel}>REVIEW FEEDBACK</Text>
          <Text style={styles.reasonText}>
            {status.rejectionReason || 'Please review the highlighted onboarding details and resubmit.'}
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>UPDATE THIS SECTION</Text>
          <Text style={styles.sectionTitle}>{stepLabel}</Text>
          <Text style={styles.sectionBody}>
            Review the information in this section, make the requested changes, and continue
            through the remaining onboarding steps.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={editSection}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>Update {stepLabel}</Text>
            <Text style={styles.primaryArrow}>→</Text>
          </Pressable>
        </View>

        <Text style={styles.footerText}>
          After updating your details, your application will return to admin review.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    padding: spacing.screen,
    paddingBottom: spacing.xxl,
  },
  header: {
    alignSelf: 'stretch',
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    color: colors.heading,
    fontSize: 34,
    lineHeight: 36,
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logo: {
    width: 24,
    height: 24,
  },
  headerTitle: {
    color: colors.heading,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.headingSm,
    fontWeight: typography.weights.semibold,
  },
  alertIcon: {
    width: 96,
    height: 96,
    marginTop: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    backgroundColor: colors.error,
  },
  alertMark: {
    color: colors.white,
    fontSize: 54,
    lineHeight: 60,
    fontWeight: typography.weights.bold,
  },
  title: {
    marginTop: spacing.lg,
    color: colors.heading,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.heading,
    lineHeight: typography.lineHeights.heading,
    fontWeight: typography.weights.semibold,
    textAlign: 'center',
  },
  body: {
    maxWidth: 310,
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    lineHeight: typography.lineHeights.input,
    textAlign: 'center',
  },
  reasonCard: {
    alignSelf: 'stretch',
    marginTop: spacing.xl,
    padding: spacing.card,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  reasonLabel: {
    color: colors.error,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.label,
  },
  reasonText: {
    marginTop: spacing.sm,
    color: colors.heading,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
  },
  sectionCard: {
    alignSelf: 'stretch',
    marginTop: spacing.lg,
    padding: spacing.card,
    borderRadius: 12,
    backgroundColor: colors.tintSoft,
  },
  sectionLabel: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.label,
  },
  sectionTitle: {
    marginTop: spacing.sm,
    color: colors.heading,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.headingSm,
    lineHeight: typography.lineHeights.headingSm,
    fontWeight: typography.weights.semibold,
  },
  sectionBody: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
  },
  primaryButton: {
    minHeight: spacing.input,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  primaryButtonText: {
    color: colors.white,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
  },
  primaryArrow: {
    color: colors.white,
    fontSize: 22,
    lineHeight: 22,
  },
  pressed: {
    opacity: 0.88,
  },
  footerText: {
    maxWidth: 300,
    marginTop: spacing.xl,
    color: colors.textMuted,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    textAlign: 'center',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.card,
  },
  stateTitle: {
    marginTop: spacing.lg,
    color: colors.heading,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.headingSm,
    lineHeight: typography.lineHeights.headingSm,
    fontWeight: typography.weights.semibold,
    textAlign: 'center',
  },
  stateText: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    textAlign: 'center',
  },
});
