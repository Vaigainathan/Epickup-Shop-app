import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Href, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenError, ScreenLoading } from '@/components/screen-status';
import { colors, spacing, typography } from '@/constants/theme';
import { fetchShopProducts } from '@/lib/catalogue-api';
import {
  DashboardApiError,
  DashboardStats,
  fetchDashboardStats,
  fetchShopProfile,
  updateShopStatus,
} from '@/lib/dashboard-api';

const logo = require('@/assets/images/login/logo.png');

type OrderStatusKey = 'awaiting_payment' | 'preparing' | 'ready';

function formatEarnings(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export default function DashboardScreen() {
  const [shopName, setShopName] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [productCount, setProductCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setStatusError(null);

    try {
      const [profile, nextStats, products] = await Promise.all([
        fetchShopProfile(),
        fetchDashboardStats(),
        fetchShopProducts().catch(() => []),
      ]);
      setShopName(profile.shopName);
      setIsOpen(profile.isOpen);
      setStats(nextStats);
      setProductCount(products.length);
    } catch (loadError) {
      setError(
        loadError instanceof DashboardApiError
          ? loadError.message
          : 'Could not load your dashboard.',
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

  async function handleOpenChange(next: boolean) {
    if (statusSaving) return;
    if (next && productCount === 0) return;

    setStatusSaving(true);
    setStatusError(null);
    try {
      const updated = await updateShopStatus(next);
      setIsOpen(updated);
    } catch (toggleError) {
      setStatusError(
        toggleError instanceof DashboardApiError
          ? toggleError.message
          : 'Could not update store status.',
      );
    } finally {
      setStatusSaving(false);
    }
  }

  function openOrders(status: OrderStatusKey) {
    router.push(`/(app)/(orders)?status=${encodeURIComponent(status)}` as Href);
  }

  function openAddProduct() {
    router.push('/(app)/(catalogue)/add-product' as Href);
  }

  function openSettings() {
    router.push('/(app)/(settings)' as Href);
  }

  if (loading && !stats) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenLoading />
      </SafeAreaView>
    );
  }

  if (error && !stats) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenError message={error} onRetry={load} />
      </SafeAreaView>
    );
  }

  if (!stats) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenError message="Could not load your dashboard." onRetry={load} />
      </SafeAreaView>
    );
  }

  const isFirstTime = productCount === 0;
  const canTurnOn = productCount > 0;
  const switchDisabled = statusSaving || (!canTurnOn && !isOpen);

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
          <View style={[styles.openPill, !isOpen && styles.openPillClosed]}>
            <View style={[styles.openDot, !isOpen && styles.openDotClosed]} />
            <Text style={[styles.openPillText, !isOpen && styles.openPillTextClosed]}>
              {isOpen ? 'Open' : 'Closed'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={openSettings}
            style={({ pressed }) => [styles.profileButton, pressed && styles.pressed]}>
            <MaterialCommunityIcons name="account-outline" size={16} color={colors.white} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {isFirstTime ? (
          <>
            <View style={styles.welcome}>
              <Text style={styles.welcomeTitle}>
                {shopName ? `Welcome, ${shopName}` : 'Welcome'}
              </Text>
              <Text style={styles.welcomeBody}>
                Your digital storefront is ready. Add your first product to start receiving orders.
              </Text>
            </View>

            <View style={styles.statusCard}>
              <View style={styles.statusHeader}>
                <View style={styles.flex}>
                  <Text style={styles.statusTitle}>Store Status</Text>
                  <Text style={styles.statusHint}>Add products to go online</Text>
                </View>
                <Switch
                  value={isOpen}
                  onValueChange={handleOpenChange}
                  disabled={switchDisabled}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor={colors.white}
                  ios_backgroundColor={colors.border}
                />
              </View>
              <View style={[styles.closedPill, isOpen && styles.livePill]}>
                <View style={[styles.closedDot, isOpen && styles.liveDot]} />
                <Text style={[styles.closedText, isOpen && styles.liveText]}>
                  {isOpen ? 'Currently Open' : 'Currently Closed'}
                </Text>
              </View>
            </View>

            <View style={styles.setupCard}>
              <View style={styles.setupHeader}>
                <Text style={styles.setupTitle}>Setup Progress</Text>
                <View style={styles.setupBadge}>
                  <Text style={styles.setupBadgeText}>2/3 Complete</Text>
                </View>
              </View>
              <View style={styles.progressTrack}>
                <View style={styles.progressFill} />
              </View>
              <SetupStep done label="Business details verified" />
              <SetupStep done={false} label="Add your first product" />
              <SetupStep done label="Bank details linked" />
            </View>
          </>
        ) : (
          <View style={styles.hero}>
            <View style={styles.statusHeader}>
              <View style={styles.flex}>
                <Text style={styles.heroEyebrow}>CURRENT STATUS</Text>
                <Text style={styles.heroTitle}>{isOpen ? 'Store is Open' : 'Store is Closed'}</Text>
              </View>
              <Switch
                value={isOpen}
                onValueChange={handleOpenChange}
                disabled={switchDisabled}
                trackColor={{ false: colors.border, true: colors.accentSoft }}
                thumbColor={colors.white}
                ios_backgroundColor={colors.border}
              />
            </View>
            <Text style={styles.heroBody}>
              {isOpen
                ? 'Accepting new pickup orders.'
                : 'Not accepting new orders right now.'}
            </Text>
          </View>
        )}

        {statusError ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{statusError}</Text>
          </View>
        ) : null}

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>TODAY'S{'\n'}EARNINGS</Text>
            <Text style={styles.statValue}>{formatEarnings(stats.todayEarnings)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>TOTAL ORDERS</Text>
            <Text style={styles.statValue}>{stats.totalOrders}</Text>
          </View>
        </View>

        {isFirstTime ? (
          <View style={styles.emptyCta}>
            <View style={styles.emptyIcon}>
              <MaterialCommunityIcons name="package-variant" size={28} color={colors.success} />
            </View>
            <Text style={styles.emptyTitle}>Your Catalog is Empty</Text>
            <Text style={styles.emptyBody}>
              Add your first product to start receiving orders and go live on the ePickup network.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={openAddProduct}
              style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
              <MaterialCommunityIcons name="plus" size={14} color={colors.white} />
              <Text style={styles.ctaLabel}>Add Your First Product</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.operations}>
            <Text style={styles.operationsTitle}>Live Operations</Text>
            <OperationRow
              title="Awaiting Payment"
              subtitle="Waiting for confirmation"
              count={stats.awaitingPayment}
              onPress={() => openOrders('awaiting_payment')}
            />
            <OperationRow
              title="Preparing"
              subtitle="Being prepared"
              count={stats.preparing}
              onPress={() => openOrders('preparing')}
            />
            <OperationRow
              title="Ready"
              subtitle="Waiting for pickup"
              count={stats.ready}
              onPress={() => openOrders('ready')}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

type SetupStepProps = {
  done: boolean;
  label: string;
};

function SetupStep({ done, label }: SetupStepProps) {
  return (
    <View style={styles.setupStep}>
      <View style={[styles.setupCheck, done ? styles.setupCheckDone : styles.setupCheckTodo]}>
        <MaterialCommunityIcons
          name={done ? 'check' : 'plus'}
          size={12}
          color={done ? colors.white : colors.heading}
        />
      </View>
      <Text style={[styles.setupLabel, !done && styles.setupLabelActive]}>{label}</Text>
    </View>
  );
}

type OperationRowProps = {
  title: string;
  subtitle: string;
  count: number;
  onPress: () => void;
};

function OperationRow({ title, subtitle, count, onPress }: OperationRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.operationRow, pressed && styles.pressed]}>
      <View style={styles.flex}>
        <Text style={styles.operationTitle}>{title}</Text>
        <Text style={styles.operationSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.countBadge}>
        <Text style={styles.countText}>{count}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={colors.heading} />
    </Pressable>
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
    gap: spacing.lg,
  },
  welcome: {
    backgroundColor: colors.hero,
    borderRadius: 12,
    padding: spacing.card,
    gap: spacing.xs,
    overflow: 'hidden',
  },
  welcomeTitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.display,
    lineHeight: typography.lineHeights.display,
    fontWeight: typography.weights.bold,
    letterSpacing: typography.letterSpacing.display,
    color: colors.white,
  },
  welcomeBody: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    lineHeight: typography.lineHeights.input,
    color: colors.overlayHeroText,
  },
  statusCard: {
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
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  statusTitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.headingSm,
    lineHeight: typography.lineHeights.headingSm,
    fontWeight: typography.weights.semibold,
    color: colors.heading,
  },
  statusHint: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    lineHeight: typography.lineHeights.input,
    color: colors.accent,
  },
  closedPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.stepperTrack,
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: spacing.xs,
  },
  livePill: {
    backgroundColor: colors.overlayTrust,
  },
  closedDot: {
    width: 8,
    height: 8,
    borderRadius: 9999,
    backgroundColor: colors.textMuted,
  },
  liveDot: {
    backgroundColor: colors.accent,
  },
  closedText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    lineHeight: typography.lineHeights.input,
    color: colors.textSecondary,
  },
  liveText: {
    color: colors.success,
  },
  setupCard: {
    backgroundColor: colors.mapFill,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.md,
  },
  setupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  setupTitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.headingSm,
    lineHeight: typography.lineHeights.headingSm,
    fontWeight: typography.weights.semibold,
    color: colors.heading,
  },
  setupBadge: {
    backgroundColor: colors.tintSoft,
    borderRadius: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  setupBadgeText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    lineHeight: typography.lineHeights.input,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  progressTrack: {
    height: 8,
    borderRadius: 9999,
    backgroundColor: colors.stepperTrack,
    overflow: 'hidden',
  },
  progressFill: {
    width: '66.67%',
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 9999,
  },
  setupStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  setupCheck: {
    width: 24,
    height: 24,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupCheckDone: {
    backgroundColor: colors.accent,
  },
  setupCheckTodo: {
    backgroundColor: colors.stepperTrack,
  },
  setupLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    lineHeight: typography.lineHeights.input,
    color: colors.heading,
  },
  setupLabelActive: {
    fontWeight: typography.weights.semibold,
  },
  hero: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.card,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
  },
  heroEyebrow: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
    letterSpacing: typography.letterSpacing.label,
    color: colors.white,
    opacity: 0.8,
  },
  heroTitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.heading,
    lineHeight: typography.lineHeights.heading,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.heading,
    color: colors.white,
  },
  heroBody: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.white,
    opacity: 0.9,
  },
  banner: {
    backgroundColor: colors.overlayPrimary,
    borderRadius: 12,
    padding: spacing.md,
  },
  bannerText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.medium,
    color: colors.error,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  statLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    lineHeight: typography.lineHeights.input,
    letterSpacing: 0.4,
    color: colors.textSecondary,
  },
  statValue: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.heading,
    lineHeight: typography.lineHeights.heading,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.heading,
    color: colors.textMuted,
  },
  emptyCta: {
    backgroundColor: colors.accentSoft,
    borderRadius: 12,
    padding: spacing.card,
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 9999,
    backgroundColor: 'rgba(0, 113, 101, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.headingSm,
    lineHeight: typography.lineHeights.headingSm,
    fontWeight: typography.weights.semibold,
    color: colors.success,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    lineHeight: typography.lineHeights.input,
    color: 'rgba(0, 113, 101, 0.8)',
    textAlign: 'center',
  },
  cta: {
    height: 48,
    width: '100%',
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  ctaLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    lineHeight: typography.lineHeights.input,
    color: colors.white,
  },
  operations: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
  operationsTitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.headingSm,
    lineHeight: typography.lineHeights.headingSm,
    fontWeight: typography.weights.semibold,
    color: colors.heading,
    marginBottom: spacing.sm,
  },
  operationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  operationTitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
    color: colors.heading,
  },
  operationSubtitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    color: colors.textSecondary,
  },
  countBadge: {
    minWidth: 32,
    height: 32,
    borderRadius: 9999,
    backgroundColor: colors.tintSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  countText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  pressed: {
    opacity: 0.9,
  },
});
