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

import { OrderPaymentActions } from '@/components/payment/OrderPaymentActions';
import { ScreenError, ScreenLoading } from '@/components/screen-status';
import { colors, spacing, typography } from '@/constants/theme';
import {
  cancelShopOrder,
  cancelledDetailCopy,
  confirmOrderHandover,
  fetchShopOrder,
  formatDisplayId,
  formatInr,
  formatIstTime,
  itemCount,
  markOrderReady,
  OrdersApiError,
  ordersErrorMessage,
  relativeTime,
  shopOrderLabelDetail,
  shopOrderLabelShort,
  ShopOrder,
  showRefundDuePill,
} from '@/lib/orders-api';
import { orderNeedsWarningPill } from '@/lib/shop-order-actions';

const CANCEL_REASONS = ['Out of stock', 'Shop closing soon', 'Technical issue', 'Other'] as const;

function paramId(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

type AddressDisplay = {
  lines: string[];
  labelTag: string | null;
};

function normalizeAddressPart(value: string): string {
  return value.trim().toLowerCase();
}

function formatAddressDisplay(order: ShopOrder): AddressDisplay {
  const addr = order.deliveryAddress;
  if (!addr) {
    const text = order.deliveryAddressText?.trim();
    return { lines: text ? [text] : [], labelTag: null };
  }

  const labelTag = addr.label?.trim() || null;
  const lines: string[] = [];

  const receiver = [addr.receiverName, addr.receiverPhone].filter(Boolean).join(' · ');
  if (receiver) lines.push(receiver);

  const streetLine = [addr.houseNo, addr.street].filter(Boolean).join(', ');
  if (streetLine) lines.push(streetLine);

  const landmark = addr.landmark?.trim();
  if (landmark && (!labelTag || normalizeAddressPart(landmark) !== normalizeAddressPart(labelTag))) {
    lines.push(landmark);
  }

  const text = addr.text?.trim();
  if (lines.length === 0 && text) {
    const dupLabel = labelTag && normalizeAddressPart(text) === normalizeAddressPart(labelTag);
    if (!dupLabel) lines.push(text);
  }

  return { lines, labelTag };
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

  function applyOrder(next: ShopOrder, _refundRequired: boolean | null) {
    setOrder(next);
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
  const warningPill = orderNeedsWarningPill(order);
  const received = relativeTime(order.createdAt);
  const statusShort = shopOrderLabelShort(order);
  const statusDetail = shopOrderLabelDetail(order);
  const expectedAmount = order.expectedAmount ?? order.payment.amount;
  const payBy = formatIstTime(order.window.end);
  const addressDisplay = formatAddressDisplay(order);
  const showDelivery = addressDisplay.lines.length > 0 || addressDisplay.labelTag !== null;
  const showPayByRow =
    Boolean(payBy) &&
    (order.orderStatus === 'awaiting_payment' ||
      order.orderStatus === 'payment_unconfirmed' ||
      order.orderStatus === 'payment_review');
  const customerName = order.customerName?.trim() ?? '';

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
          <View style={styles.statusTags}>
            <View
              style={[
                styles.statusPill,
                order.orderStatus === 'ready' && styles.statusPillReady,
                warningPill && styles.statusPillWarning,
              ]}>
              <Text
                numberOfLines={2}
                style={[
                  styles.statusPillText,
                  order.orderStatus === 'ready' && styles.statusPillTextReady,
                  warningPill && styles.statusPillTextWarning,
                ]}>
                {statusShort}
              </Text>
            </View>
            {showRefundDuePill(order) ? (
              <View style={styles.refundPill}>
                <Text style={styles.refundPillText}>Refund due</Text>
              </View>
            ) : null}
          </View>
          <Text numberOfLines={1} style={styles.displayId}>
            {formatDisplayId(order.displayId)}
          </Text>
        </View>
        {statusDetail ? <Text style={styles.statusDetail}>{statusDetail}</Text> : null}
        {received ? <Text style={styles.received}>Received {received.toLowerCase()}</Text> : null}

        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>CUSTOMER & PAYMENT</Text>
          {customerName ? (
            <Text style={styles.bodyLine}>
              <Text style={styles.bodyLabel}>Customer: </Text>
              {customerName}
            </Text>
          ) : null}
          {order.payerUpiName ? (
            <Text style={styles.bodyLine}>
              <Text style={styles.bodyLabel}>Name on UPI: </Text>
              {order.payerUpiName}
            </Text>
          ) : null}
          {order.payment.customerUtr ? (
            <Text style={styles.bodyLine}>
              <Text style={styles.bodyLabel}>Customer UTR: </Text>
              {order.payment.customerUtr}
            </Text>
          ) : null}
          <Text style={styles.bodyLine}>
            <Text style={styles.bodyLabel}>Expected amount: </Text>
            {formatInr(expectedAmount)}
          </Text>
          {showPayByRow ? (
            <Text style={styles.bodyLine}>
              <Text style={styles.bodyLabel}>Pay by: </Text>
              {payBy} IST
            </Text>
          ) : null}
        </View>

        {order.customerNote ? (
          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>CUSTOMER NOTE</Text>
            <Text style={styles.address}>{order.customerNote}</Text>
          </View>
        ) : null}

        {showDelivery ? (
          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>DELIVERY ADDRESS</Text>
            {addressDisplay.labelTag ? (
              <View style={styles.addressLabelTag}>
                <Text style={styles.addressLabelTagText}>{addressDisplay.labelTag}</Text>
              </View>
            ) : null}
            {addressDisplay.lines.map((line, index) => (
              <Text key={`${line}-${index}`} style={styles.address}>
                {line}
              </Text>
            ))}
          </View>
        ) : null}

        {order.stockShortOpen ? (
          <View style={styles.stockBanner}>
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.error} />
            <Text style={styles.stockBannerText}>
              Stock short — mark unavailable items or cancel with refund when available.
            </Text>
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
          {order.deliveryFee > 0 ? (
            <View style={styles.rowBetween}>
              <Text style={styles.totalLabel}>Delivery fee (driver, not UPI)</Text>
              <Text style={styles.totalValue}>{formatInr(order.deliveryFee)}</Text>
            </View>
          ) : null}
          <Text style={styles.totalHint}>
            {order.deliveryFee > 0
              ? 'Confirm only the items amount in your UPI app. Delivery fee is collected by the driver in cash.'
              : 'Delivery fee is collected in cash by the driver.'}
          </Text>
        </View>

        {order.orderStatus === 'cancelled' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Cancelled</Text>
            <Text style={styles.body}>{cancelledDetailCopy(order)}</Text>
          </View>
        ) : null}

        {actionError ? <Text style={styles.inlineError}>{actionError}</Text> : null}

        <OrderPaymentActions
          order={order}
          busy={busy}
          setBusy={setBusy}
          onOrderUpdated={(next) => setOrder(next)}
          onActionError={setActionError}
          onRefundSent={load}
        />

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
    width: 48,
    height: 48,
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
  content: {
    padding: spacing.screen,
    paddingBottom: spacing.section,
    gap: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
},
  statusTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    flex: 1,
    minWidth: 0,
},
  refundPill: {
    borderRadius: 9999,
    paddingVertical: spacing.xs,
    paddingHorizontal: 12,
    backgroundColor: colors.overlayPrimary,
},
  refundPillText: {
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.error,
    fontFamily: typography.fonts.medium,
  },
  statusDetail: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.textSecondary,
  },
  bodyLine: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.heading,
  },
  bodyLabel: {
    color: colors.textSecondary,
  },
  stockBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.overlayPrimary,
    borderRadius: 12,
    padding: spacing.md,
},
  stockBannerText: {
    flex: 1,
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.error,
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
  statusPillWarning: {
    backgroundColor: colors.overlayPrimary,
  },
  statusPillText: {
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontFamily: typography.fonts.medium,
    letterSpacing: 0,
    color: colors.success,
    includeFontPadding: false,
    paddingRight: 2,
  },
  statusPillTextReady: {
    color: colors.success,
  },
  statusPillTextWarning: {
    color: colors.error,
  },
  displayId: {
    flexShrink: 0,
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    color: colors.textSecondary,
  },
  received: {
    fontFamily: typography.fonts.regular,
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
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    letterSpacing: typography.letterSpacing.overline,
    color: colors.textSecondary,
  },
  cardTitle: {
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontFamily: typography.fonts.semibold,
    color: colors.heading,
  },
  address: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.heading,
  },
  addressLabelTag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.tintSoft,
    borderRadius: 6,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
},
  addressLabelTagText: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    color: colors.textSecondary,
  },
  body: {
    fontFamily: typography.fonts.regular,
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
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontFamily: typography.fonts.medium,
    color: colors.heading,
  },
  driverMeta: {
    fontFamily: typography.fonts.regular,
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
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    letterSpacing: typography.letterSpacing.overline,
    color: colors.white,
    opacity: 0.8,
  },
  otpValue: {
    fontSize: typography.sizes.display,
    lineHeight: typography.lineHeights.display,
    fontFamily: typography.fonts.bold,
    letterSpacing: typography.letterSpacing.display,
    color: colors.white,
  },
  otpId: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.overlayHeroText,
  },
  hint: {
    fontFamily: typography.fonts.regular,
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
    fontFamily: typography.fonts.regular,
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
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.heading,
  },
  itemMeta: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.textSecondary,
  },
  itemPrice: {
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontFamily: typography.fonts.semibold,
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
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.textSecondary,
  },
  totalValue: {
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontFamily: typography.fonts.semibold,
    color: colors.heading,
  },
  totalHint: {
    fontFamily: typography.fonts.regular,
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
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontFamily: typography.fonts.semibold,
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
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontFamily: typography.fonts.semibold,
    color: colors.error,
  },
  inlineError: {
    fontFamily: typography.fonts.regular,
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
    fontSize: typography.sizes.headingSm,
    lineHeight: typography.lineHeights.headingSm,
    fontFamily: typography.fonts.semibold,
    color: colors.heading,
    textAlign: 'center',
  },
  modalBody: {
    fontFamily: typography.fonts.regular,
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
    fontFamily: typography.fonts.regular,
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
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontFamily: typography.fonts.semibold,
    color: colors.heading,
  },
});
