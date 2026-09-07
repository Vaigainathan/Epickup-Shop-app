import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Href, router, useFocusEffect } from 'expo-router';
import { getAuth } from '@react-native-firebase/auth';
import { useCallback, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenError, ScreenLoading } from '@/components/screen-status';
import { colors, spacing, typography } from '@/constants/theme';
import {
  DashboardApiError,
  fetchPaymentHistory,
  fetchShopProfile,
  PaymentHistoryItem,
  ShopProfile,
} from '@/lib/dashboard-api';
import { formatDisplayId, formatInr } from '@/lib/orders-api';
import { wipeShopSession } from '@/lib/session';

const logo = require('@/assets/images/login/logo.png');

function displayValue(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : '—';
}

function maskUpi(upi: string): string {
  const at = upi.indexOf('@');
  if (at <= 0) {
    if (upi.length <= 4) return '••••';
    return `${upi.slice(0, 2)}••••${upi.slice(-2)}`;
  }
  const name = upi.slice(0, at);
  const handle = upi.slice(at);
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}••••${handle}`;
}

export default function SettingsScreen() {
  const [profile, setProfile] = useState<ShopProfile | null>(null);
  const [payments, setPayments] = useState<PaymentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextProfile, nextPayments] = await Promise.all([
        fetchShopProfile(),
        fetchPaymentHistory().catch(() => [] as PaymentHistoryItem[]),
      ]);
      setProfile(nextProfile);
      setPayments(nextPayments.slice(0, 2));
    } catch (loadError) {
      setError(
        loadError instanceof DashboardApiError
          ? loadError.message
          : 'Could not load your settings.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function confirmLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError(null);
    try {
      try {
        const auth = getAuth();
        if (auth.currentUser) {
          await auth.signOut();
        }
      } catch {
        // OTP leftover only; shop login is token-based.
      }

      const cleared = await wipeShopSession();
      if (!cleared) {
        setLogoutError('Could not clear your session. Please try again.');
        return;
      }

      setLogoutOpen(false);
      router.replace('/(auth)/login');
    } catch {
      setLogoutError('Could not log out. Please try again.');
    } finally {
      setLoggingOut(false);
    }
  }

  if (loading && !profile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenLoading />
      </SafeAreaView>
    );
  }

  if (error && !profile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenError message={error} onRetry={load} />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenError message="Could not load your settings." onRetry={load} />
      </SafeAreaView>
    );
  }

  const maskedUpi = profile.upiId ? maskUpi(profile.upiId) : '—';
  const last4 = profile.accountNumberLast4 ? `•••• ${profile.accountNumberLast4}` : '—';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <Image source={logo} style={styles.logo} contentFit="contain" />
          <Text numberOfLines={1} style={styles.headerTitle}>
            ePickup Shop
          </Text>
        </View>
        <View style={styles.headerActions}>
          <View style={[styles.openPill, !profile.isOpen && styles.openPillClosed]}>
            <View style={[styles.openDot, !profile.isOpen && styles.openDotClosed]} />
            <Text style={[styles.openPillText, !profile.isOpen && styles.openPillTextClosed]}>
              {profile.isOpen ? 'Open' : 'Closed'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Profile"
            onPress={() => router.push('/(app)/(settings)/account' as Href)}
            style={({ pressed }) => [styles.profileButton, pressed && styles.pressed]}>
            <MaterialCommunityIcons name="account-outline" size={16} color={colors.white} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Settings</Text>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Payment History</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(app)/(settings)/payment-history' as Href)}
              style={({ pressed }) => pressed && styles.pressed}>
              <Text style={styles.viewAll}>View All</Text>
            </Pressable>
          </View>
          {payments.length === 0 ? (
            <Text style={styles.emptyHint}>No payments yet</Text>
          ) : (
            payments.map((item) => (
              <View key={item.orderId} style={styles.paymentRow}>
                <Text numberOfLines={1} style={styles.paymentRef}>
                  {formatDisplayId(item.displayId)}
                </Text>
                <Text numberOfLines={1} style={styles.paymentAmount}>
                  {formatInr(item.amount)}
                </Text>
                <View
                  style={[
                    styles.paymentStatusPill,
                    item.paymentStatus === 'refunded' && styles.paymentStatusPillRefunded,
                  ]}>
                  <Text
                    style={[
                      styles.paymentStatus,
                      item.paymentStatus === 'refunded' && styles.paymentStatusRefunded,
                    ]}>
                    {item.paymentStatus === 'refunded' ? 'Refunded' : 'Confirmed'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(app)/(settings)/business-profile' as Href)}
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
          <View style={styles.rowHeader}>
            <MaterialCommunityIcons name="storefront-outline" size={20} color={colors.heading} />
            <Text style={styles.cardTitle}>Business Profile</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.heading} />
          </View>
          <Field label="Shop Name" value={displayValue(profile.shopName)} />
          <Field label="Shop Type" value={displayValue(profile.shopType)} />
          <Field label="Address" value={displayValue(profile.address)} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(app)/(settings)/documents' as Href)}
          style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}>
          <MaterialCommunityIcons name="shield-check-outline" size={20} color={colors.heading} />
          <Text style={styles.menuLabel}>Compliance Documents</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.heading} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(app)/(settings)/bank-details' as Href)}
          style={({ pressed }) => [styles.card, styles.bankCard, pressed && styles.pressed]}>
          <View style={styles.rowHeader}>
            <MaterialCommunityIcons name="bank-outline" size={20} color={colors.white} />
            <Text style={styles.bankTitle}>UPI / Bank Details</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.white} />
          </View>
          {profile.bankName ? <Text style={styles.bankName}>{profile.bankName}</Text> : null}
          <Text style={styles.bankMeta}>Account {last4}</Text>
          <Text style={styles.bankMeta}>IFSC {displayValue(profile.ifsc)}</Text>
          <Text style={styles.bankMeta}>UPI {maskedUpi}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(app)/(settings)/deactivate' as Href)}
          style={({ pressed }) => [styles.dangerRow, pressed && styles.pressed]}>
          <View style={styles.flex}>
            <Text style={styles.dangerTitle}>Deactivate Shop</Text>
            <Text style={styles.dangerHint}>Temporarily hide your shop from users.</Text>
          </View>
          <MaterialCommunityIcons name="cancel" size={22} color={colors.error} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setLogoutError(null);
            setLogoutOpen(true);
          }}
          style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}>
          <MaterialCommunityIcons name="logout" size={20} color={colors.heading} />
          <Text style={styles.menuLabel}>Logout</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={logoutOpen}
        transparent
        animationType="slide"
        onRequestClose={() => !loggingOut && setLogoutOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable
            style={styles.modalDismiss}
            onPress={() => !loggingOut && setLogoutOpen(false)}
          />
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Log out of ePickup Shop?</Text>
            {logoutError ? <Text style={styles.bannerText}>{logoutError}</Text> : null}
            <Pressable
              accessibilityRole="button"
              disabled={loggingOut}
              onPress={confirmLogout}
              style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}>
              <Text style={styles.logoutLabel}>{loggingOut ? 'Logging out…' : 'Log out'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={loggingOut}
              onPress={() => setLogoutOpen(false)}
              style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}>
              <Text style={styles.cancelLabel}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    backgroundColor: colors.overlayHeader,
  },
  headerBrand: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logo: {
    width: 32,
    height: 32,
    flexShrink: 0,
  },
  headerTitle: {
    flexShrink: 1,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.headingSm,
    lineHeight: typography.lineHeights.headingSm,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  headerActions: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  openPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.overlayTrust,
    borderRadius: 9999,
    paddingVertical: spacing.xs,
    paddingLeft: 12,
    paddingRight: 14,
    flexShrink: 0,
  },
  openPillClosed: {
    backgroundColor: colors.overlayPrimary,
  },
  openDot: {
    width: 8,
    height: 8,
    borderRadius: 9999,
    backgroundColor: colors.accent,
  },
  openDotClosed: {
    backgroundColor: colors.textMuted,
  },
  openPillText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
    letterSpacing: 0,
    color: colors.success,
    includeFontPadding: false,
    paddingRight: 2,
  },
  openPillTextClosed: {
    color: colors.error,
  },
  profileButton: {
    width: 32,
    height: 32,
    borderRadius: 9999,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing.screen,
    paddingBottom: spacing.section,
    gap: spacing.md,
  },
  pageTitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.heading,
    lineHeight: typography.lineHeights.heading,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.heading,
    color: colors.heading,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.headingSm,
    lineHeight: typography.lineHeights.headingSm,
    fontWeight: typography.weights.semibold,
    color: colors.heading,
  },
  viewAll: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  emptyHint: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.textSecondary,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  paymentRef: {
    flex: 1,
    minWidth: 0,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.heading,
  },
  paymentAmount: {
    flexShrink: 0,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
    color: colors.heading,
  },
  paymentStatusPill: {
    flexShrink: 0,
    backgroundColor: colors.overlayTrust,
    borderRadius: 9999,
    paddingVertical: 4,
    paddingLeft: 10,
    paddingRight: 14,
    overflow: 'visible',
  },
  paymentStatusPillRefunded: {
    backgroundColor: colors.overlayPrimary,
  },
  paymentStatus: {
    flexShrink: 0,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
    letterSpacing: 0,
    color: colors.success,
    includeFontPadding: false,
    paddingRight: 2,
  },
  paymentStatusRefunded: {
    color: colors.error,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  field: {
    gap: 2,
  },
  fieldLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    color: colors.textSecondary,
  },
  fieldValue: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.heading,
  },
  menuRow: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  menuLabel: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
    color: colors.heading,
  },
  bankCard: {
    backgroundColor: colors.primary,
  },
  bankTitle: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.headingSm,
    lineHeight: typography.lineHeights.headingSm,
    fontWeight: typography.weights.semibold,
    color: colors.white,
  },
  bankName: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
    color: colors.white,
  },
  bankMeta: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.overlayHeroText,
  },
  dangerRow: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dangerTitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
    color: colors.error,
  },
  dangerHint: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    color: colors.textSecondary,
  },
  pressed: {
    opacity: 0.9,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  modalDismiss: {
    flex: 1,
  },
  modalCard: {
    padding: spacing.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 9999,
    backgroundColor: colors.border,
  },
  modalTitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.headingSm,
    lineHeight: typography.lineHeights.headingSm,
    fontWeight: typography.weights.semibold,
    color: colors.heading,
  },
  bannerText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.error,
  },
  logoutButton: {
    height: spacing.input,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    color: colors.white,
  },
  cancelButton: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    color: colors.textSecondary,
  },
});
