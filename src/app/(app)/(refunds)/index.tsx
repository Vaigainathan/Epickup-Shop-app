import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarkRefundSentSheet } from '@/components/refunds/MarkRefundSentSheet';
import { ScreenError, ScreenLoading } from '@/components/screen-status';
import { colors, spacing, typography } from '@/constants/theme';
import { formatRefundListRow } from '@/lib/refund-format';
import { fetchShopRefunds, type ShopRefundListItem } from '@/lib/refunds-api';
import { ordersErrorMessage } from '@/lib/orders-api';

type Segment = 'due' | 'overdue' | 'sent';

export default function RefundsScreen() {
  const params = useLocalSearchParams<{ orderId?: string }>();
  const highlightOrderId = typeof params.orderId === 'string' ? params.orderId : undefined;

  const [segment, setSegment] = useState<Segment>('due');
  const [refunds, setRefunds] = useState<ShopRefundListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ShopRefundListItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (segment === 'due') {
        const [due, overdue] = await Promise.all([
          fetchShopRefunds('due'),
          fetchShopRefunds('overdue'),
        ]);
        setRefunds([...overdue, ...due]);
      } else {
        setRefunds(await fetchShopRefunds(segment));
      }
    } catch (loadError) {
      setError(ordersErrorMessage(loadError, 'Could not load refunds.'));
    } finally {
      setLoading(false);
    }
  }, [segment]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const emptyCopy = useMemo(() => {
    if (segment === 'sent') return 'No sent refunds yet.';
    return "No refunds due — you're all caught up.";
  }, [segment]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.nav}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={colors.heading} />
        </Pressable>
        <Text style={styles.navTitle}>Refunds due</Text>
      </View>

      <View style={styles.segments}>
        {(['due', 'overdue', 'sent'] as Segment[]).map((key) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            onPress={() => setSegment(key)}
            style={[styles.segment, segment === key && styles.segmentOn]}>
            <Text style={[styles.segmentLabel, segment === key && styles.segmentLabelOn]}>
              {key === 'due' ? 'Due' : key === 'overdue' ? 'Overdue' : 'Sent'}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading && refunds.length === 0 ? <ScreenLoading /> : null}
      {error && refunds.length === 0 ? <ScreenError message={error} onRetry={load} /> : null}

      {!loading && !error && refunds.length === 0 ? (
        <Text style={styles.empty}>{emptyCopy}</Text>
      ) : null}

      <FlatList
        data={refunds}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const row = formatRefundListRow(item);
          const highlighted = highlightOrderId === item.orderId;
          const canSend = item.status === 'due' || item.status === 'overdue';
          const disputed = item.status === 'disputed';

          return (
            <Pressable
              accessibilityRole="button"
              disabled={!canSend || disputed}
              onPress={() => canSend && !disputed && setSelected(item)}
              style={[styles.row, highlighted && styles.rowHighlight]}>
              <View style={styles.rowTop}>
                <Text style={styles.rowTitle}>{row.title}</Text>
                <Text style={styles.rowAmount}>{row.amountLabel}</Text>
              </View>
              <Text style={styles.rowSub}>{row.subtitle}</Text>
              <Text style={styles.rowReason}>{row.reasonLine}</Text>
              {row.dueLabel ? (
                <Text style={[styles.rowDue, row.overdue && styles.rowOverdue]}>{row.dueLabel}</Text>
              ) : null}
              {row.overdue ? (
                <View style={styles.overdueBadge}>
                  <Text style={styles.overdueText}>Overdue</Text>
                </View>
              ) : null}
              {disputed ? (
                <Text style={styles.disputed}>Refund under review</Text>
              ) : null}
            </Pressable>
          );
        }}
      />

      {selected && selected.amount != null ? (
        <MarkRefundSentSheet
          visible
          orderId={selected.orderId}
          refundId={selected.id}
          amount={selected.amount}
          customerUpiId={selected.customerUpiId}
          onClose={() => setSelected(null)}
          onSuccess={() => {
            setSelected(null);
            load();
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  nav: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    gap: spacing.md,
  },
  back: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: typography.sizes.headingSm,
    fontFamily: typography.fonts.semibold,
    color: colors.heading,
  },
  segments: {
    flexDirection: 'row',
    paddingHorizontal: spacing.screen,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  segment: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 9999,
    backgroundColor: colors.tintSoft,
  },
  segmentOn: {
    backgroundColor: colors.primary,
  },
  segmentLabel: {
    fontFamily: typography.fonts.medium,
    fontSize: typography.sizes.label,
    color: colors.textSecondary,
  },
  segmentLabelOn: {
    color: colors.white,
  },
  list: {
    padding: spacing.screen,
    gap: spacing.sm,
  },
  empty: {
    padding: spacing.screen,
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  rowHighlight: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  rowTitle: {
    fontFamily: typography.fonts.semibold,
    fontSize: typography.sizes.body,
    color: colors.heading,
    flex: 1,
  },
  rowAmount: {
    fontFamily: typography.fonts.semibold,
    fontSize: typography.sizes.body,
    color: colors.heading,
  },
  rowSub: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.label,
    color: colors.textSecondary,
  },
  rowReason: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
  },
  rowDue: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.label,
    color: colors.textSecondary,
  },
  rowOverdue: {
    color: colors.error,
  },
  overdueBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.overlayPrimary,
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  overdueText: {
    fontFamily: typography.fonts.medium,
    fontSize: typography.sizes.caption,
    color: colors.error,
  },
  disputed: {
    fontFamily: typography.fonts.medium,
    fontSize: typography.sizes.body,
    color: colors.error,
  },
});
