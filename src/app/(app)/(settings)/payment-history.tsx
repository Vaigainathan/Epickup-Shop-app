import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenError, ScreenLoading } from '@/components/screen-status';
import { colors, spacing, typography } from '@/constants/theme';
import {
  DashboardApiError,
  fetchPaymentHistory,
  PaymentHistoryItem,
} from '@/lib/dashboard-api';
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchPaymentHistory());
    } catch (loadError) {
      setError(
        loadError instanceof DashboardApiError
          ? loadError.message
          : 'Could not load payment history.',
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

  if (loading && items.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenLoading />
      </SafeAreaView>
    );
  }

  if (error && items.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header onBack={() => router.back()} />
        <ScreenError message={error} onRetry={load} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header onBack={() => router.back()} />
      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No payments yet</Text>
          <Text style={styles.emptyBody}>
            Confirmed and refunded order payments will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.orderId}
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
      )}
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
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.headingSm,
    lineHeight: typography.lineHeights.headingSm,
    fontWeight: typography.weights.semibold,
    color: colors.heading,
  },
  list: {
    padding: spacing.screen,
    gap: spacing.sm,
    paddingBottom: spacing.section,
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
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
    color: colors.heading,
  },
  ref: {
    fontFamily: typography.fontFamily,
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
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.bold,
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
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
    letterSpacing: 0,
    color: colors.success,
    includeFontPadding: false,
    textAlign: 'center',
    paddingRight: 2,
  },
  statusTextRefunded: {
    color: colors.error,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.headingSm,
    lineHeight: typography.lineHeights.headingSm,
    fontWeight: typography.weights.semibold,
    color: colors.heading,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.9,
  },
});
