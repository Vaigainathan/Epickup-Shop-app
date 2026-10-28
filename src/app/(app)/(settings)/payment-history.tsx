import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Href, router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PaymentHistoryEarningsSection } from '@/components/earnings/PaymentHistoryEarningsSection';
import { ScreenLoading } from '@/components/screen-status';
import { colors, spacing, typography } from '@/constants/theme';
import { fetchPaymentHistory, PaymentHistoryItem } from '@/lib/dashboard-api';
import { fetchShopEarnings, type ShopEarnings } from '@/lib/earnings-api';
import { earningsErrorMessage } from '@/lib/earnings-error-messages';
import { paymentHistoryErrorMessage } from '@/lib/payment-history-error-messages';
import { formatDisplayId, formatInr } from '@/lib/orders-api';

function formatDate(date: Date | null): string {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

// Calendar / date-range breakdown is a follow-up: GET /api/shop/payment-history has no from/to query.
export default function PaymentHistoryScreen() {
  const [items, setItems] = useState<PaymentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [earnings, setEarnings] = useState<ShopEarnings | null>(null);
  const [earningsLoading, setEarningsLoading] = useState(true);
  const [earningsError, setEarningsError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchPaymentHistory());
    } catch (loadError) {
      setError(paymentHistoryErrorMessage(loadError, 'Could not load payment history.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEarnings = useCallback(async () => {
    setEarningsLoading(true);
    setEarningsError(null);
    try {
      setEarnings(await fetchShopEarnings());
    } catch (loadError) {
      setEarningsError(earningsErrorMessage(loadError, "Couldn't load earnings."));
    } finally {
      setEarningsLoading(false);
    }
  }, []);

  const onRefundsDuePress = useCallback(() => {
    router.push('/(app)/(refunds)' as Href);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      loadEarnings();
    }, [load, loadEarnings]),
  );

  const earningsHeader = useMemo(
    () => (
      <PaymentHistoryEarningsSection
        earnings={earnings}
        loading={earningsLoading}
        error={earningsError}
        onRetry={loadEarnings}
        onRefundsDuePress={onRefundsDuePress}
      />
    ),
    [earnings, earningsLoading, earningsError],
  );

  const listEmpty = useMemo(() => {
    if (error) {
      return (
        <View style={styles.listEmpty}>
          <Text style={styles.emptyTitle}>Could not load payment history</Text>
          <Text style={styles.emptyBody}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={load}
            style={({ pressed }) => [styles.historyRetryButton, pressed && styles.pressed]}>
            <Text style={styles.historyRetryLabel}>Retry</Text>
          </Pressable>
        </View>
      );
    }
    if (!loading) {
      return (
        <View style={styles.listEmpty}>
          <Text style={styles.emptyTitle}>No payments yet</Text>
          <Text style={styles.emptyBody}>
            Confirmed and refunded order payments will appear here.
          </Text>
        </View>
      );
    }
    return null;
  }, [error, loading, load]);

  if (loading && items.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenLoading />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header onBack={() => router.back()} />
      <FlatList
        data={items}
        keyExtractor={(item) => item.orderId}
        ListHeaderComponent={earningsHeader}
        ListEmptyComponent={listEmpty}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View
              style={[
                styles.icon,
                item.paymentStatus === 'refunded' && styles.iconRefunded,
              ]}>
              <MaterialCommunityIcons
                name={item.paymentStatus === 'refunded' ? 'cash-refund' : 'check'}
                size={20}
                color={item.paymentStatus === 'refunded' ? colors.error : colors.accent}
              />
            </View>
            <View style={styles.meta}>
              <Text numberOfLines={1} style={styles.date}>
                {formatDate(item.at) || '—'}
              </Text>
              <Text numberOfLines={1} style={styles.ref}>
                {formatDisplayId(item.displayId)}
              </Text>
            </View>
            <View style={styles.amountCol}>
              <Text numberOfLines={1} style={styles.amount}>
                {formatInr(item.amount)}
              </Text>
              <View
                style={[
                  styles.statusPill,
                  item.paymentStatus === 'refunded' && styles.statusRefunded,
                ]}>
                <Text
                  style={[
                    styles.statusText,
                    item.paymentStatus === 'refunded' && styles.statusTextRefunded,
                  ]}>
                  {item.paymentStatus === 'refunded' ? 'Refunded' : 'Confirmed'}
                </Text>
              </View>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.nav}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
        <MaterialCommunityIcons name="arrow-left" size={20} color={colors.heading} />
      </Pressable>
      <Text style={styles.navTitle}>Payment History</Text>
    </View>
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
    fontSize: typography.sizes.headingSm,
    lineHeight: typography.lineHeights.headingSm,
    fontFamily: typography.fonts.semibold,
    color: colors.heading,
  },
  list: {
    padding: spacing.screen,
    gap: spacing.sm,
    paddingBottom: spacing.section,
    flexGrow: 1,
  },
  listEmpty: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  historyRetryButton: {
    minHeight: 48,
    minWidth: 120,
    paddingHorizontal: spacing.lg,
    borderRadius: 9999,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  historyRetryLabel: {
    fontFamily: typography.fonts.semibold,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    letterSpacing: typography.letterSpacing.button,
    color: colors.white,
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    backgroundColor: colors.overlayTrust,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRefunded: {
    backgroundColor: colors.overlayPrimary,
  },
  date: {
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontFamily: typography.fonts.semibold,
    color: colors.heading,
  },
  ref: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    letterSpacing: typography.letterSpacing.label,
    color: colors.textSecondary,
  },
  amountCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: spacing.xs,
    flexShrink: 0,
  },
  amount: {
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontFamily: typography.fonts.bold,
    color: colors.heading,
  },
  statusPill: {
    backgroundColor: colors.overlayTrust,
    borderRadius: 9999,
    paddingVertical: 5,
    paddingLeft: 12,
    paddingRight: 16,
    flexShrink: 0,
    alignSelf: 'flex-end',
    overflow: 'visible',
  },
  statusRefunded: {
    backgroundColor: colors.overlayPrimary,
  },
  statusText: {
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontFamily: typography.fonts.medium,
    letterSpacing: 0,
    color: colors.success,
    includeFontPadding: false,
    textAlign: 'center',
    paddingRight: 2,
  },
  statusTextRefunded: {
    color: colors.error,
  },
  emptyTitle: {
    fontSize: typography.sizes.headingSm,
    lineHeight: typography.lineHeights.headingSm,
    fontFamily: typography.fonts.semibold,
    color: colors.heading,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.9,
  },
});
