import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, typography } from '@/constants/theme';
import { DashboardApiError, deactivateShop } from '@/lib/dashboard-api';
import { wipeShopSession } from '@/lib/session';

export default function DeactivateShopScreen() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inProgress, setInProgress] = useState(false);

  async function handleDeactivate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setInProgress(false);
    try {
      await deactivateShop();
      const cleared = await wipeShopSession();
      if (!cleared) {
        setError('Shop deactivated, but the session could not be cleared. Please log out.');
        return;
      }
      router.replace('/(auth)/login');
    } catch (deactivateError) {
      if (
        deactivateError instanceof DashboardApiError &&
        (deactivateError.code === 'ORDERS_IN_PROGRESS' || deactivateError.status === 409)
      ) {
        setInProgress(true);
        setError(
          'Cannot deactivate while orders are in progress. Finish current orders, then try again.',
        );
      } else {
        setError(
          deactivateError instanceof DashboardApiError
            ? deactivateError.message
            : 'Could not deactivate your shop.',
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.nav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          disabled={busy}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={colors.heading} />
        </Pressable>
        <Text style={styles.navTitle}>Deactivate Shop</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons name="logout" size={24} color={colors.error} />
          </View>
          <Text style={styles.title}>Deactivate The Shop</Text>
          <Text style={styles.copy}>Are you sure you want to deactivate your shop account?</Text>
          {error ? (
            <Text style={[styles.error, inProgress && styles.inProgress]}>{error}</Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={handleDeactivate}
            style={({ pressed }) => [styles.deactivate, busy && styles.disabled, pressed && styles.pressed]}>
            {busy ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.deactivateLabel}>Deactivate</Text>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}>
            <Text style={styles.cancelLabel}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  nav: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    gap: spacing.md,
    backgroundColor: colors.overlayHeader,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.headingSm,
    lineHeight: typography.lineHeights.headingSm,
    fontWeight: typography.weights.semibold,
    color: colors.heading,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.screen,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.card,
    gap: spacing.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 9999,
    backgroundColor: colors.overlayPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.heading,
    lineHeight: typography.lineHeights.heading,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.heading,
    color: colors.heading,
    textAlign: 'center',
  },
  copy: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  error: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.error,
    textAlign: 'center',
  },
  inProgress: {
    color: colors.heading,
  },
  deactivate: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deactivateLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
    color: colors.white,
  },
  cancel: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.tintSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.9,
  },
});
