import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/constants/theme';
import {
  EARNINGS_PERIOD_KEYS,
  type EarningsPeriodKey,
  type ShopEarnings,
} from '@/lib/earnings-api';
import {
  earningsPeriodContextLabel,
  formatRefundedDisplay,
} from '@/lib/earnings-format';
import { formatInr, formatIstTime } from '@/lib/orders-api';

const PERIOD_LABELS: Record<EarningsPeriodKey, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  thisMonth: 'This month',
  lastMonth: 'Last month',
  allTime: 'All time',
};

const EARNINGS_LOAD_FAILED_COPY = "Couldn't load earnings.";

function earningsInlineErrorCopy(mappedError: string): {
  primary: string;
  secondary: string | null;
} {
  if (mappedError === EARNINGS_LOAD_FAILED_COPY) {
    return { primary: EARNINGS_LOAD_FAILED_COPY, secondary: null };
  }
  return { primary: EARNINGS_LOAD_FAILED_COPY, secondary: mappedError };
}

type PaymentHistoryEarningsSectionProps = {
  earnings: ShopEarnings | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onRefundsDuePress: () => void;
};

export function PaymentHistoryEarningsSection({
  earnings,
  loading,
  error,
  onRetry,
  onRefundsDuePress,
}: PaymentHistoryEarningsSectionProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<EarningsPeriodKey>('today');
  const periodStats = earnings?.periods[selectedPeriod] ?? null;
  const contextLabel = earnings
    ? earningsPeriodContextLabel(selectedPeriod, earnings.asOf)
    : null;
  const inlineError = error ? earningsInlineErrorCopy(error) : null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Earnings</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillsContent}>
        {EARNINGS_PERIOD_KEYS.map((key) => {
          const selected = key === selectedPeriod;
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setSelectedPeriod(key)}
              style={[styles.pill, selected && styles.pillOn]}>
              <Text style={[styles.pillLabel, selected && styles.pillLabelOn]}>
                {PERIOD_LABELS[key]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.card}>
        {loading && !earnings && !error ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading…</Text>
          </View>
        ) : null}

        {inlineError ? (
          <View style={styles.inlineError}>
            <Text style={styles.inlineErrorText}>{inlineError.primary}</Text>
            {inlineError.secondary ? (
              <Text style={styles.inlineErrorDetail}>{inlineError.secondary}</Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={onRetry}
              style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
              <Text style={styles.retryLabel}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {!error && periodStats ? (
          <>
            <Text style={styles.netLabel}>Net earned</Text>
            {contextLabel ? <Text style={styles.netContext}>{contextLabel}</Text> : null}
            <Text style={styles.netValue}>{formatInr(periodStats.net)}</Text>

            <View style={styles.divider} />

            <MoneyRow label="Received" value={formatInr(periodStats.received)} />
            <MoneyRow
              label="Refunded"
              value={formatRefundedDisplay(periodStats.refunded, formatInr)}
            />
            <MoneyRow label="Net" value={formatInr(periodStats.net)} />

            <View style={styles.divider} />

            <CountRow label="Paid orders" value={periodStats.paidOrders} />
            <CountRow label="Completed" value={periodStats.completedOrders} />
            <CountRow label="Cancelled" value={periodStats.cancelledOrders} />
            <CountRow label="Refunds sent" value={periodStats.refundsSent} />

            {earnings && earnings.refundsDue.count > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={onRefundsDuePress}
                style={({ pressed }) => [styles.refundsDueRow, pressed && styles.pressed]}>
                <Text style={styles.refundsDueText}>
                  Refunds due: {earnings.refundsDue.count} · {formatInr(earnings.refundsDue.amount)}{' '}
                  (not deducted until sent)
                </Text>
              </Pressable>
            ) : null}

            {earnings?.asOf ? (
              <Text style={styles.updated}>
                Updated {formatIstTime(earnings.asOf) ?? '—'}
              </Text>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  );
}

function MoneyRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function CountRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{String(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sizes.headingSm,
    lineHeight: typography.lineHeights.headingSm,
    fontFamily: typography.fonts.semibold,
    color: colors.heading,
  },
  pillsContent: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pill: {
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 9999,
    backgroundColor: colors.tintSoft,
  },
  pillOn: {
    backgroundColor: colors.primary,
  },
  pillLabel: {
    fontFamily: typography.fonts.medium,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    color: colors.textSecondary,
  },
  pillLabelOn: {
    color: colors.white,
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
  loadingBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  loadingText: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.textSecondary,
  },
  inlineError: {
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  inlineErrorText: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.error,
  },
  inlineErrorDetail: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    color: colors.textSecondary,
  },
  retryButton: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: 9999,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryLabel: {
    fontFamily: typography.fonts.semibold,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    letterSpacing: typography.letterSpacing.button,
    color: colors.white,
  },
  netLabel: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    color: colors.textSecondary,
  },
  netContext: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    color: colors.textMuted,
  },
  netValue: {
    fontSize: typography.sizes.heading,
    lineHeight: typography.lineHeights.heading,
    fontFamily: typography.fonts.semibold,
    letterSpacing: typography.letterSpacing.heading,
    color: colors.heading,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rowLabel: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.textSecondary,
  },
  rowValue: {
    fontFamily: typography.fonts.semibold,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.heading,
  },
  refundsDueRow: {
    minHeight: 48,
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  refundsDueText: {
    fontFamily: typography.fonts.medium,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.primary,
  },
  updated: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  pressed: {
    opacity: 0.9,
  },
});
