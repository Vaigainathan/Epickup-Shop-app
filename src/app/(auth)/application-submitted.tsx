import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
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
import { routeAfterAuthenticatedSession } from '@/lib/onboarding-routing';

const logo = require('@/assets/images/login/logo.png');

const FEATURES = [
  { icon: '▥', label: 'Real-time Insights', color: colors.primary },
  { icon: '▱', label: 'Live Order Tracking', color: colors.accent },
  { icon: '▣', label: 'Direct, Secure Payments', color: colors.success },
];

export default function ApplicationSubmittedScreen() {
  const [checking, setChecking] = useState(false);

  async function checkStatus() {
    if (checking) return;
    setChecking(true);
    try {
      await routeAfterAuthenticatedSession();
    } finally {
      setChecking(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Image source={logo} style={styles.logo} contentFit="contain" />
          <Text style={styles.headerTitle}>ePickup Shop</Text>
        </View>

        <View style={styles.successArea}>
          <View style={styles.successCircle}>
            <Text style={styles.successMark}>✓</Text>
          </View>
          <View style={styles.progress}>
            <View style={styles.progressDone} />
            <View style={styles.progressDone} />
            <View style={styles.progressDoneWide} />
          </View>
        </View>

        <View style={styles.contentCard}>
          <Text style={styles.title}>Application Submitted!</Text>
          <Text style={styles.body}>
            Great job! Your details are now with our admin team for review.
          </Text>
          <Text style={styles.body}>
            Please stay on this screen until the review is complete. Dashboard access unlocks
            after approval.
          </Text>

          <View style={styles.statusCard}>
            <View style={styles.statusIcon}>
              <Text style={styles.statusMark}>✓</Text>
            </View>
            <View style={styles.statusCopy}>
              <Text style={styles.statusOverline}>VERIFICATION STATUS</Text>
              <Text style={styles.statusText}>Awaiting final review...</Text>
            </View>
          </View>
        </View>

        <View style={styles.features}>
          {FEATURES.map((feature) => (
            <View key={feature.label} style={styles.featureCard}>
              <Text style={[styles.featureIcon, { color: feature.color }]}>{feature.icon}</Text>
              <Text style={styles.featureLabel}>{feature.label}</Text>
            </View>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={checking}
          onPress={checkStatus}
          style={({ pressed }) => [
            styles.checkButton,
            pressed && !checking && styles.pressed,
          ]}>
          {checking ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.checkButtonText}>Check Status</Text>
          )}
        </Pressable>

        <Text style={styles.supportText}>
          Need help? <Text style={styles.supportLink}>Contact Support</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
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
  successArea: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  successCircle: {
    width: 128,
    height: 128,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
  },
  successMark: {
    color: colors.white,
    fontSize: 70,
    lineHeight: 78,
    fontWeight: typography.weights.bold,
  },
  progress: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  progressDone: {
    width: 32,
    height: 6,
    borderRadius: 9999,
    backgroundColor: colors.accent,
  },
  progressDoneWide: {
    width: 48,
    height: 6,
    borderRadius: 9999,
    backgroundColor: colors.accent,
  },
  contentCard: {
    width: '100%',
    padding: spacing.card,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  title: {
    color: colors.heading,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.heading,
    lineHeight: typography.lineHeights.heading,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.heading,
    textAlign: 'center',
  },
  body: {
    maxWidth: 300,
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    lineHeight: typography.lineHeights.input,
    textAlign: 'center',
  },
  statusCard: {
    alignSelf: 'stretch',
    marginTop: spacing.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.mapFill,
  },
  statusIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    backgroundColor: colors.accentSoft,
  },
  statusMark: {
    color: colors.success,
    fontSize: 24,
    fontWeight: typography.weights.bold,
  },
  statusCopy: {
    flex: 1,
  },
  statusOverline: {
    color: colors.success,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
    letterSpacing: typography.letterSpacing.label,
  },
  statusText: {
    marginTop: spacing.xs,
    color: colors.heading,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
  },
  features: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  featureCard: {
    minHeight: 64,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.tintSoft,
  },
  featureIcon: {
    fontSize: 22,
    lineHeight: 24,
  },
  featureLabel: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
    letterSpacing: typography.letterSpacing.label,
  },
  checkButton: {
    width: '100%',
    minHeight: 48,
    marginTop: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    backgroundColor: colors.white,
  },
  checkButtonText: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
  },
  pressed: {
    opacity: 0.85,
  },
  supportText: {
    marginTop: spacing.lg,
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
  },
  supportLink: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
});
