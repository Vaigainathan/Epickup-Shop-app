import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Href, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenError, ScreenLoading } from '@/components/screen-status';
import { colors, spacing, typography } from '@/constants/theme';
import { DashboardApiError, fetchShopProfile } from '@/lib/dashboard-api';
import {
  fetchShopOrders,
  formatDisplayId,
  formatInr,
  itemCount,
  OrdersApiError,
  ordersErrorMessage,
  OrdersListFilter,
  relativeTime,
  ShopOrder,
  ShopOrderStatus,
} from '@/lib/orders-api';

const logo = require('@/assets/images/login/logo.png');
const emptyIllustration = require('@/assets/images/orders/empty-orders.png');

const FILTERS: { key: OrdersListFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'awaiting_payment', label: 'Awaiting Payment' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready', label: 'Ready' },
  { key: 'completed', label: 'Done' },
];

function paramStatus(raw: string | string[] | undefined): OrdersListFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === 'awaiting_payment' || value === 'preparing' || value === 'ready' || value === 'completed') {
    return value;
  }
  return 'all';
}

function statusLabel(status: ShopOrderStatus): string {
  switch (status) {
    case 'awaiting_payment':
      return 'Awaiting Payment';
    case 'preparing':
      return 'Preparing';
    case 'ready':
      return 'Ready';
    case 'handed_over':
      return 'Handed Over';
    case 'completed':
      return 'Done';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}

function paymentTag(order: ShopOrder): { label: string; tone: 'pending' | 'ok' | 'warn' | 'muted' } | null {
  const status = order.payment.status;
  if (status === 'expired') return { label: 'Expired', tone: 'warn' };
  if (status === 'refunded') return { label: 'Refunded', tone: 'muted' };
  if (status === 'refund_pending') return { label: 'Refund pending', tone: 'warn' };
  if (status === 'confirmed') return { label: 'Confirmed', tone: 'ok' };
  if (order.orderStatus === 'awaiting_payment') return { label: 'Pending', tone: 'pending' };
  return null;
}

function emptyCopy(filter: OrdersListFilter): { title: string; body: string } {
  switch (filter) {
    case 'awaiting_payment':
      return {
        title: 'No orders awaiting payment',
        body: 'New orders will show here until you confirm payment.',
      };
    case 'preparing':
      return {
        title: 'No orders being prepared',
        body: 'Accepted orders will show here until they are marked ready.',
      };
    case 'ready':
      return {
        title: 'No orders ready for pickup',
        body: 'Orders marked ready will show here until handover.',
      };
    case 'completed':
      return {
        title: 'No completed orders',
        body: 'Finished orders will show here after delivery is complete.',
      };
    default:
      return {
        title: 'No orders yet',
        body: 'When customers place orders, they will appear here. Check Store Status if you expect orders.',
      };
  }
}

export default function OrdersScreen() {
  const params = useLocalSearchParams<{ status?: string | string[] }>();
  const userFilter = useRef<OrdersListFilter | null>(null);
  const lastStatusParam = useRef<string | undefined>(undefined);
  const [filter, setFilter] = useState<OrdersListFilter>(() => paramStatus(params.status));
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async (nextFilter: OrdersListFilter, replaceList = false) => {
    setLoading(true);
    setError(null);
    if (replaceList) setOrders([]);
    try {
      const [nextOrders, profile] = await Promise.all([
        fetchShopOrders(nextFilter),
        fetchShopProfile().catch(() => null),
      ]);
      setOrders(nextOrders);
      if (profile) setIsOpen(profile.isOpen);
    } catch (loadError) {
      setError(
        loadError instanceof OrdersApiError || loadError instanceof DashboardApiError
          ? ordersErrorMessage(loadError, 'Could not load orders.')
          : 'Could not load orders.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const paramKey = Array.isArray(params.status) ? params.status[0] : params.status;
      const paramChanged = paramKey !== lastStatusParam.current;
      if (paramChanged) {
        lastStatusParam.current = paramKey;
        userFilter.current = null;
      }
      const next = userFilter.current ?? paramStatus(params.status);
      setFilter(next);
      load(next, paramChanged);
    }, [load, params.status]),
  );

  function selectFilter(next: OrdersListFilter) {
    userFilter.current = next;
    setFilter(next);
    load(next, true);
  }

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase().replace(/^#/, '');
    if (!query) return orders;
    return orders.filter((order) => {
      const display = formatDisplayId(order.displayId).toLowerCase().replace(/^#/, '');
      if (display.includes(query) || String(order.displayId ?? '').includes(query)) return true;
      return order.items.some((item) => item.name.toLowerCase().includes(query));
    });
  }, [orders, search]);

  if (loading && orders.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenLoading />
      </SafeAreaView>
    );
  }

  if (error && orders.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenError message={error} onRetry={() => load(filter)} />
      </SafeAreaView>
    );
  }

  const empty = emptyCopy(filter);
  const listEmpty = visible.length === 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <Image source={logo} style={styles.logo} contentFit="contain" />
          <Text numberOfLines={1} style={styles.headerTitle}>
            ePickup Shop
          </Text>
        </View>
        <View style={[styles.openPill, !isOpen && styles.openPillClosed]}>
          <View style={[styles.openDot, !isOpen && styles.openDotClosed]} />
          <Text style={[styles.openPillText, !isOpen && styles.openPillTextClosed]}>
            {isOpen ? 'Open' : 'Closed'}
          </Text>
        </View>
      </View>

      <Text style={styles.pageTitle}>Orders</Text>

      <View style={styles.searchShell}>
        <MaterialCommunityIcons name="magnify" size={18} color={colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search order ID..."
          placeholderTextColor={colors.textPlaceholder}
          style={styles.searchInput}
        />
      </View>

      <View style={styles.chipRow} collapsable={false}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}>
          {FILTERS.map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              onPress={() => selectFilter(item.key)}
              style={[styles.chip, filter === item.key && styles.chipSelected]}>
              <Text
                numberOfLines={1}
                style={[styles.chipLabel, filter === item.key && styles.chipLabelSelected]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {error ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{error}</Text>
        </View>
      ) : null}

      {listEmpty ? (
        <View style={styles.empty}>
          <Image source={emptyIllustration} style={styles.emptyImage} contentFit="contain" />
          <Text style={styles.emptyTitle}>{empty.title}</Text>
          <Text style={styles.emptyBody}>{empty.body}</Text>
          {filter === 'all' ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(app)/(dashboard)' as Href)}
              style={({ pressed }) => [styles.emptyLink, pressed && styles.pressed]}>
              <Text style={styles.emptyLinkText}>Check Store Status</Text>
              <MaterialCommunityIcons name="chevron-right" size={16} color={colors.primary} />
            </Pressable>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          style={styles.listFlex}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              onPress={() => router.push(`/(app)/(orders)/${encodeURIComponent(item.id)}` as Href)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function OrderCard({ order, onPress }: { order: ShopOrder; onPress: () => void }) {
  const pay = paymentTag(order);
  const done = order.orderStatus === 'completed' || order.orderStatus === 'cancelled';
  const ready = order.orderStatus === 'ready';
  const count = itemCount(order);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, ready && styles.cardReady, pressed && styles.pressed]}>
      <View style={styles.cardTop}>
        <View style={styles.flex}>
          <Text numberOfLines={1} style={[styles.orderId, done && styles.muted]}>
            ORDER {formatDisplayId(order.displayId)}
          </Text>
          <Text numberOfLines={1} style={[styles.amount, done && styles.muted]}>
            {formatInr(order.payment.amount)}
          </Text>
        </View>
        <View style={styles.tags}>
          <View
            style={[
              styles.statusPill,
              order.orderStatus === 'ready' && styles.statusReady,
              order.orderStatus === 'preparing' && styles.statusPreparing,
              order.orderStatus === 'awaiting_payment' && styles.statusAwaiting,
              done && styles.statusDone,
            ]}>
            <Text
              numberOfLines={1}
              style={[
                styles.statusText,
                order.orderStatus === 'ready' && styles.statusTextReady,
                done && styles.statusTextDone,
              ]}>
              {statusLabel(order.orderStatus)}
            </Text>
          </View>
          {pay ? (
            <View
              style={[
                styles.payPill,
                pay.tone === 'ok' && styles.payOk,
                pay.tone === 'warn' && styles.payWarn,
                pay.tone === 'muted' && styles.payMuted,
              ]}>
              <Text
                numberOfLines={1}
                style={[
                  styles.payText,
                  pay.tone === 'ok' && styles.payTextOk,
                  pay.tone === 'warn' && styles.payTextWarn,
                  pay.tone === 'muted' && styles.payTextMuted,
                ]}>
                {pay.label}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.cardMeta}>
        <View style={styles.metaRow}>
          <MaterialCommunityIcons name="cart-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.metaText}>
            {count} {count === 1 ? 'item' : 'items'}
          </Text>
        </View>
        <Text style={styles.metaText}>{relativeTime(order.createdAt)}</Text>
      </View>
      <View style={styles.cardFooter}>
        <Text numberOfLines={1} style={[styles.footerHint, ready && styles.footerReady]}>
          {order.orderStatus === 'ready'
            ? 'Awaiting pickup'
            : order.orderStatus === 'handed_over'
              ? 'Handed to driver'
              : order.payment.status === 'expired'
                ? "Payment wasn't confirmed in time"
                : relativeTime(order.createdAt)
                  ? `Ordered ${relativeTime(order.createdAt).toLowerCase()}`
                  : ''}
        </Text>
        <Text style={styles.detailsLink}>Details {'>'}</Text>
      </View>
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
    minWidth: 0,
  },
  header: {
    height: 64,
    flexShrink: 0,
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
  pageTitle: {
    flexShrink: 0,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.sm,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.heading,
    lineHeight: typography.lineHeights.heading,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.heading,
    color: colors.heading,
  },
  searchShell: {
    flexShrink: 0,
    marginHorizontal: spacing.screen,
    marginTop: spacing.md,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.heading,
  },
  chipRow: {
    flexGrow: 0,
    flexShrink: 0,
    marginTop: spacing.md,
    minHeight: 44,
  },
  chips: {
    flexGrow: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  chip: {
    flexShrink: 0,
    backgroundColor: colors.tintSoft,
    borderRadius: 9999,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: 18,
  },
  chipSelected: {
    backgroundColor: colors.primary,
  },
  chipLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  chipLabelSelected: {
    color: colors.white,
  },
  banner: {
    marginHorizontal: spacing.screen,
    marginBottom: spacing.sm,
    backgroundColor: colors.overlayPrimary,
    borderRadius: 12,
    padding: spacing.md,
  },
  bannerText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.error,
  },
  listFlex: {
    flex: 1,
  },
  list: {
    padding: spacing.screen,
    gap: spacing.md,
    paddingBottom: spacing.section,
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
  cardReady: {
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
  },
  cardTop: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  orderId: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    letterSpacing: typography.letterSpacing.label,
    color: colors.textSecondary,
  },
  amount: {
    marginTop: spacing.xs,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.headingSm,
    lineHeight: typography.lineHeights.headingSm,
    fontWeight: typography.weights.semibold,
    color: colors.heading,
  },
  muted: {
    color: colors.textMuted,
  },
  tags: {
    alignItems: 'flex-end',
    gap: spacing.xs,
    flexShrink: 0,
    maxWidth: '62%',
  },
  statusPill: {
    borderRadius: 9999,
    paddingVertical: spacing.xs,
    paddingLeft: 12,
    paddingRight: 16,
    backgroundColor: colors.overlayPrimary,
    flexShrink: 0,
    overflow: 'visible',
  },
  statusAwaiting: {
    backgroundColor: colors.overlayPrimary,
  },
  statusPreparing: {
    backgroundColor: colors.tintSoft,
  },
  statusReady: {
    backgroundColor: colors.overlayTrust,
  },
  statusDone: {
    backgroundColor: colors.tintSoft,
  },
  statusText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
    letterSpacing: 0,
    color: colors.hero,
    includeFontPadding: false,
    paddingRight: 2,
  },
  statusTextReady: {
    color: colors.success,
  },
  statusTextDone: {
    color: colors.textMuted,
  },
  payPill: {
    borderRadius: 9999,
    paddingVertical: 4,
    paddingLeft: 12,
    paddingRight: 16,
    backgroundColor: colors.overlayPrimary,
    flexShrink: 0,
    overflow: 'visible',
  },
  payOk: {
    backgroundColor: colors.overlayTrust,
  },
  payWarn: {
    backgroundColor: colors.overlayPrimary,
  },
  payMuted: {
    backgroundColor: colors.tintSoft,
  },
  payText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    letterSpacing: 0,
    color: colors.textSecondary,
    includeFontPadding: false,
    paddingRight: 2,
  },
  payTextOk: {
    color: colors.success,
  },
  payTextWarn: {
    color: colors.error,
  },
  payTextMuted: {
    color: colors.textMuted,
  },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.textSecondary,
  },
  cardFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerHint: {
    flex: 1,
    minWidth: 0,
    paddingRight: spacing.sm,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    color: colors.textMuted,
  },
  footerReady: {
    color: colors.success,
  },
  detailsLink: {
    flexShrink: 0,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptyImage: {
    width: 192,
    height: 192,
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
    maxWidth: 280,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyLink: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  emptyLinkText: {
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
