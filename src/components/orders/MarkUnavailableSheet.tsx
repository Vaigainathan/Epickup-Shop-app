import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/constants/theme';
import { formatInr } from '@/lib/orders-api';
import {
  isItemMarkableUnavailable,
  orderItemLineId,
  validateMarkUnavailableSelection,
} from '@/lib/mark-unavailable-selection';
import type { ShopOrder } from '@/lib/shop-order-types';

type Props = {
  visible: boolean;
  order: ShopOrder;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (itemIds: string[]) => void;
};

export function MarkUnavailableSheet({
  visible,
  order,
  busy,
  error,
  onClose,
  onConfirm,
}: Props) {
  const markableRows = useMemo(
    () =>
      order.items
        .map((item, index) => ({ item, index, lineId: orderItemLineId(item, index) }))
        .filter(({ item }) => isItemMarkableUnavailable(item)),
    [order],
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleConfirm() {
    const validation = validateMarkUnavailableSelection(order, [...selected]);
    if (!validation.ok) return;
    onConfirm(validation.itemIds);
  }

  const canSubmit = selected.size > 0 && !busy;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => !busy && onClose()}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismiss} onPress={() => !busy && onClose()} />
        <View style={styles.card}>
          <View style={styles.handle} />
          <Text style={styles.title}>Mark unavailable items</Text>
          <Text style={styles.body}>
            The customer gets a partial refund for items you mark unavailable. Select every item you
            can’t supply.
          </Text>
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {markableRows.map(({ item, lineId }) => {
              const on = selected.has(lineId);
              return (
                <Pressable
                  key={lineId}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  disabled={busy}
                  onPress={() => toggle(lineId)}
                  style={[styles.row, on && styles.rowOn]}>
                  <View style={[styles.box, on && styles.boxOn]} />
                  <View style={styles.flex}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemMeta}>Qty {item.qty}</Text>
                  </View>
                  <Text style={styles.itemPrice}>{formatInr(item.price * item.qty)}</Text>
                </Pressable>
              );
            })}
            {markableRows.length === 0 ? (
              <Text style={styles.empty}>No items can be marked unavailable.</Text>
            ) : null}
          </ScrollView>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={!canSubmit}
            onPress={handleConfirm}
            style={({ pressed }) => [
              styles.primary,
              !canSubmit && styles.disabled,
              pressed && styles.pressed,
            ]}>
            {busy ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.primaryLabel}>Confirm</Text>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onClose}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
            <Text style={styles.secondaryLabel}>Go back</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlayStatus,
  },
  dismiss: { flex: 1 },
  card: {
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.section,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  title: {
    fontFamily: typography.fonts.semibold,
    fontSize: typography.sizes.headingSm,
    color: colors.heading,
  },
  body: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.textSecondary,
  },
  list: { maxHeight: 280 },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowOn: { backgroundColor: colors.overlayPrimary },
  box: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.borderStrong,
  },
  boxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  flex: { flex: 1 },
  itemName: {
    fontFamily: typography.fonts.medium,
    fontSize: typography.sizes.body,
    color: colors.heading,
  },
  itemMeta: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.label,
    color: colors.textMuted,
  },
  itemPrice: {
    fontFamily: typography.fonts.semibold,
    fontSize: typography.sizes.body,
    color: colors.heading,
  },
  empty: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.body,
    color: colors.textMuted,
    paddingVertical: spacing.md,
  },
  error: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.body,
    color: colors.error,
  },
  primary: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    fontFamily: typography.fonts.semibold,
    fontSize: typography.sizes.input,
    color: colors.white,
  },
  secondary: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontFamily: typography.fonts.semibold,
    fontSize: typography.sizes.body,
    color: colors.primary,
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.9 },
});
