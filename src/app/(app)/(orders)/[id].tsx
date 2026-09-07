import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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
import {
  cancelShopOrder,
  cancelledCopy,
  confirmOrderHandover,
  confirmOrderPayment,
  fetchShopOrder,
  formatDisplayId,
  formatInr,
  itemCount,
  markOrderReady,
  markRefundSent,
  OrdersApiError,
  ordersErrorMessage,
  rejectShopOrder,
  relativeTime,
  ShopOrder,
} from '@/lib/orders-api';

const CANCEL_REASONS = ['Out of stock', 'Shop closing soon', 'Technical issue', 'Other'] as const;

function paramId(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function statusLabel(order: ShopOrder): string {
  if (order.orderStatus === 'awaiting_payment') return 'AWAITING PAYMENT';
  if (order.orderStatus === 'preparing') return 'PREPARING';
  if (order.orderStatus === 'ready') return 'READY FOR PICKUP';
  if (order.orderStatus === 'handed_over') return 'HANDED OVER';
  if (order.orderStatus === 'completed') return 'DONE';
  if (order.payment.status === 'expired') return 'PAYMENT UNCONFIRMED';
  return 'CANCELLED';
}

export default function OrderDetailsScreen() {
  const { id: rawId } = useLocalSearchParams<{ id?: string | string[] }>();
  const orderId = paramId(rawId);

  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [handoverError, setHandoverError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState<string | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) {
      setError('Order not found.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setOrder(await fetchShopOrder(orderId));
    } catch (loadError) {
      setError(ordersErrorMessage(loadError, 'Could not load this order.'));
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function applyOrder(next: ShopOrder, refundRequired: boolean | null) {
    setOrder(next);
    if (refundRequired === true || next.payment.status === 'refund_pending') {
      setRefundOpen(true);
    }
  }

  async function runAction(task: () => Promise<{ order: ShopOrder; refundRequired: boolean | null }>) {
    if (!order || busy) return;
    setBusy(true);
    setActionError(null);
    setHandoverError(null);
    try {
      const result = await task();
      applyOrder(result.order, result.refundRequired);
    } catch (actionErr) {
      setActionError(ordersErrorMessage(actionErr, 'Could not update this order.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmPayment() {
    if (!order) return;
    await runAction(() => confirmOrderPayment(order.id));
  }

  async function handleReject() {
    if (!order) return;
    await runAction(() => rejectShopOrder(order.id));
  }

  async function handleMarkReady() {
    if (!order) return;
    await runAction(() => markOrderReady(order.id));
  }

  async function handleHandover() {
    if (!order || busy) return;
    const otp = otpInput.trim();
    if (!otp || order.displayId == null) {
      setHandoverError('OTP and order ID are required.');
      return;
    }
    setBusy(true);
    setHandoverError(null);
    setActionError(null);
    try {
      const result = await confirmOrderHandover(order.id, otp, order.displayId);
      setOrder(result.order);
      router.back();
    } catch (actionErr) {
      if (actionErr instanceof OrdersApiError && actionErr.code === 'HANDOVER_MISMATCH') {
        setHandoverError(ordersErrorMessage(actionErr, 'Order ID or OTP does not match.'));
      } else {
        setActionError(ordersErrorMessage(actionErr, 'Could not confirm handover.'));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!order || !cancelReason || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      const result = await cancelShopOrder(order.id, cancelReason);
      setCancelOpen(false);
      setCancelReason(null);
      applyOrder(result.order, result.refundRequired);
      if (result.refundRequired !== true && result.order.payment.status !== 'refund_pending') {
        router.back();
      }
    } catch (actionErr) {
      setActionError(ordersErrorMessage(actionErr, 'Could not cancel this order.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleRefundSent() {
    if (!order || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      const result = await markRefundSent(order.id);
      setRefundOpen(false);
      setOrder(result.order);
      router.back();
    } catch (actionErr) {
      setActionError(ordersErrorMessage(actionErr, 'Could not mark refund as sent.'));
    } finally {
      setBusy(false);
    }
  }

  if (loading && !order) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenLoading />
      </SafeAreaView>
    );
  }

  if (error && !order) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenError message={error} onRetry={load} />
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenError message="Order not found." onRetry={load} />
      </SafeAreaView>
    );
  }

  const count = itemCount(order);
  const showCancel = order.orderStatus === 'preparing' || order.orderStatus === 'ready';
  const showRefund =
    refundOpen || order.payment.status === 'refund_pending';
  const received = relativeTime(order.createdAt);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.nav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={colors.heading} />
        </Pressable>
        <Text style={styles.navTitle}>Order Details</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statusRow}>
          <View style={[styles.statusPill, order.orderStatus === 'ready' && styles.statusPillReady]}>
            <Text
              numberOfLines={1}
              style={[styles.statusPillText, order.orderStatus === 'ready' && styles.statusPillTextReady]}>
              {statusLabel(order)}
            </Text>
          </View>
          <Text numberOfLines={1} style={styles.displayId}>
            {formatDisplayId(order.displayId)}
          </Text>
        </View>
        {received ? <Text style={styles.received}>Received {received.toLowerCase()}</Text> : null}

        {order.deliveryAddressText ? (
          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>DELIVERY ADDRESS</Text>
            <Text style={styles.address}>{order.deliveryAddressText}</Text>
          </View>
        ) : null}

        {order.orderStatus === 'ready' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Handover Details</Text>
            {order.driverInfo ? (
              <View style={styles.driverRow}>
                <View style={styles.driverAvatar}>
                  <MaterialCommunityIcons name="motorbike" size={18} color={colors.white} />
                </View>
                <View style={styles.flex}>
                  {order.driverInfo.name ? (
                    <Text style={styles.driverName}>{order.driverInfo.name}</Text>
                  ) : null}
                  {order.driverInfo.vehicle ? (
                    <Text style={styles.driverMeta}>Vehicle: {order.driverInfo.vehicle}</Text>
                  ) : null}
                  {order.driverInfo.phone ? (
                    <Text style={styles.driverMeta}>{order.driverInfo.phone}</Text>
                  ) : null}
                </View>
              </View>
            ) : null}
            <View style={styles.otpBox}>
              <Text style={styles.otpLabel}>PICKUP OTP</Text>
              <Text style={styles.otpValue}>{order.handoverOtp ?? '—'}</Text>
              <Text style={styles.otpId}>{formatDisplayId(order.displayId)}</Text>
            </View>
            <Text style={styles.hint}>Ask the driver for the OTP, then confirm handover.</Text>
            <TextInput
              value={otpInput}
              onChangeText={(value) => {
                setOtpInput(value);
                setHandoverError(null);
              }}
              placeholder="Enter driver OTP"
              placeholderTextColor={colors.textPlaceholder}
              keyboardType="number-pad"
              maxLength={6}
              style={styles.otpInput}
            />
            {handoverError ? <Text style={styles.inlineError}>{handoverError}</Text> : null}
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardEyebrow}>ORDER ITEMS ({count})</Text>
          </View>
          {order.items.map((item, index) => (
            <View key={`${item.productId ?? 'item'}-${index}`} style={styles.itemRow}>
              <View style={styles.itemIcon}>
                <MaterialCommunityIcons name="package-variant" size={22} color={colors.primary} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>Qty: {item.qty}</Text>
              </View>
              <Text style={styles.itemPrice}>{formatInr(item.price)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.rowBetween}>
            <Text style={styles.totalLabel}>Items (UPI amount)</Text>
            <Text style={styles.totalValue}>{formatInr(order.itemsTotal)}</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.totalLabel}>Delivery fee (driver, not UPI)</Text>
            <Text style={styles.totalValue}>{formatInr(order.deliveryFee)}</Text>
          </View>
          <Text style={styles.totalHint}>
            Confirm only the items amount in your UPI app. Delivery fee is collected by the driver.
          </Text>
        </View>

        {order.orderStatus === 'cancelled' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Cancelled</Text>
            <Text style={styles.body}>{cancelledCopy(order)}</Text>
          </View>
        ) : null}

        {actionError ? <Text style={styles.inlineError}>{actionError}</Text> : null}

        {order.orderStatus === 'awaiting_payment' ? (
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={handleConfirmPayment}
              style={({ pressed }) => [styles.primary, busy && styles.disabled, pressed && styles.pressed]}>
              {busy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryLabel}>Confirm Payment Received & Accept Order</Text>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={handleReject}
              style={({ pressed }) => [styles.dangerText, pressed && styles.pressed]}>
              <Text style={styles.dangerLabel}>Reject Order</Text>
            </Pressable>
          </View>
        ) : null}

        {order.orderStatus === 'preparing' ? (
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={handleMarkReady}
              style={({ pressed }) => [styles.primary, busy && styles.disabled, pressed && styles.pressed]}>
              {busy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryLabel}>Mark Ready for Pickup</Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {order.orderStatus === 'ready' ? (
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={handleHandover}
              style={({ pressed }) => [styles.primary, busy && styles.disabled, pressed && styles.pressed]}>
              {busy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryLabel}>Confirm Handover</Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {showCancel ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => {
              setCancelReason(null);
              setCancelOpen(true);
            }}
            style={({ pressed }) => [styles.dangerText, pressed && styles.pressed]}>
            <Text style={styles.dangerLabel}>Cancel Order</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <Modal
        visible={cancelOpen}
        transparent
        animationType="slide"
        onRequestClose={() => !busy && setCancelOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismiss} onPress={() => !busy && setCancelOpen(false)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Cancel Order?</Text>
            <Text style={styles.modalBody}>
              Please select a reason for cancellation to notify the customer.
            </Text>
            {CANCEL_REASONS.map((reason) => (
              <Pressable
                key={reason}
                accessibilityRole="radio"
                onPress={() => setCancelReason(reason)}
                style={[styles.reasonRow, cancelReason === reason && styles.reasonSelected]}>
                <View style={[styles.radio, cancelReason === reason && styles.radioOn]} />
                <Text style={styles.reasonLabel}>{reason}</Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              disabled={busy || !cancelReason}
              onPress={handleCancel}
              style={({ pressed }) => [
                styles.confirmCancel,
                (!cancelReason || busy) && styles.disabled,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.primaryLabel}>
                {busy ? 'Cancelling…' : 'Confirm Cancellation'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => setCancelOpen(false)}
              style={({ pressed }) => [styles.goBack, pressed && styles.pressed]}>
              <Text style={styles.goBackLabel}>Go Back</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showRefund && order.payment.status === 'refund_pending'}
        transparent
        animationType="slide"
        onRequestClose={() => undefined}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Refund required</Text>
            <Text style={styles.modalBody}>
              This order requires a refund of {formatInr(order.payment.amount)}. Send it in your UPI
              app
              {order.payment.customerUpiId ? ` to ${order.payment.customerUpiId}` : ''}
              , then mark refund sent.
            </Text>
            {actionError ? <Text style={styles.inlineError}>{actionError}</Text> : null}
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={handleRefundSent}
              style={({ pressed }) => [styles.primary, busy && styles.disabled, pressed && styles.pressed]}>
              <Text style={styles.primaryLabel}>{busy ? 'Saving…' : 'Refund Sent'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
  content: {
    padding: spacing.screen,
    paddingBottom: spacing.section,
    gap: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  statusPill: {
    backgroundColor: colors.overlayTrust,
    borderRadius: 9999,
    paddingVertical: spacing.xs,
    paddingLeft: 12,
    paddingRight: 16,
    flexShrink: 1,
    maxWidth: '100%',
    overflow: 'visible',
  },
  statusPillReady: {
    backgroundColor: colors.overlayTrust,
  },
  statusPillText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
    letterSpacing: 0,
    color: colors.success,
    includeFontPadding: false,
    paddingRight: 2,
  },
  statusPillTextReady: {
    color: colors.success,
  },
  displayId: {
    flexShrink: 0,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    color: colors.textSecondary,
  },
  received: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardEyebrow: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    letterSpacing: typography.letterSpacing.overline,
    color: colors.textSecondary,
  },
  cardTitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
    color: colors.heading,
  },
  address: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.heading,
  },
  body: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.textSecondary,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.mapFill,
    borderRadius: 8,
    padding: spacing.md,
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 9999,
    backgroundColor: colors.hero,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverName: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.medium,
    color: colors.heading,
  },
  driverMeta: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.textSecondary,
  },
  otpBox: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  otpLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    letterSpacing: typography.letterSpacing.overline,
    color: colors.white,
    opacity: 0.8,
  },
  otpValue: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.display,
    lineHeight: typography.lineHeights.display,
    fontWeight: typography.weights.bold,
    letterSpacing: typography.letterSpacing.display,
    color: colors.white,
  },
  otpId: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.overlayHeroText,
  },
  hint: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.textSecondary,
  },
  otpInput: {
    height: spacing.input,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    color: colors.heading,
    backgroundColor: colors.background,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  itemIcon: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: colors.tintSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.heading,
  },
  itemMeta: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.textSecondary,
  },
  itemPrice: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
    color: colors.heading,
  },
  totals: {
    backgroundColor: colors.tintSoft,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    flex: 1,
    paddingRight: spacing.md,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.textSecondary,
  },
  totalValue: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
    color: colors.heading,
  },
  totalHint: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    color: colors.textMuted,
  },
  actions: {
    gap: spacing.sm,
  },
  primary: {
    minHeight: spacing.input,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  primaryLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.button,
    color: colors.white,
    textAlign: 'center',
    paddingHorizontal: spacing.xs,
  },
  dangerText: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
    color: colors.error,
  },
  inlineError: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.error,
  },
  disabled: {
    opacity: 0.5,
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
    textAlign: 'center',
  },
  modalBody: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.md,
  },
  reasonSelected: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: colors.borderStrong,
  },
  radioOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  reasonLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.heading,
  },
  confirmCancel: {
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goBack: {
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.tintSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goBackLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
    color: colors.heading,
  },
});
