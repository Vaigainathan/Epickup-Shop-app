import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppTextInput } from '@/components/AppTextInput';

import { AttestationCheckbox } from '@/components/payment/AttestationCheckbox';
import { ConfirmBottomSheet } from '@/components/payment/ConfirmBottomSheet';
import { UtrInputBlock } from '@/components/payment/UtrInputBlock';
import { MarkRefundSentSheet } from '@/components/refunds/MarkRefundSentSheet';
import { colors, spacing, typography } from '@/constants/theme';
import {
  actionUsesConfirmPayment,
  buildConfirmPaymentBody,
  filterUnconfirmedActions,
  getShopOrderActions,
  openRefundsForOrder,
  type ShopActionId,
} from '@/lib/shop-order-actions';
import {
  confirmOrderPayment,
  formatInr,
  OrdersApiError,
  ordersErrorMessage,
  rejectShopOrder,
  reportAmountDiffers,
  reportPaymentNotFound,
  submitPaidCheck,
  type ShopOrder,
} from '@/lib/orders-api';
import { refundReasonCopy } from '@/lib/refund-reason-copy';
import {
  buildConfirmUtrFields,
  confirmUtrBody,
} from '@/lib/utr-validation';

type Props = {
  order: ShopOrder;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onOrderUpdated: (order: ShopOrder) => void;
  onActionError: (message: string | null) => void;
  onRefundSent?: () => void;
};

export function OrderPaymentActions({
  order,
  busy,
  setBusy,
  onOrderUpdated,
  onActionError,
  onRefundSent,
}: Props) {
  const [attestationChecked, setAttestationChecked] = useState(false);
  const [activeAction, setActiveAction] = useState<ShopActionId | null>(null);
  const [phase, setPhase] = useState<'form' | 'confirm'>('form');
  const [utrLast4, setUtrLast4] = useState('');
  const [fullUtr, setFullUtr] = useState('');
  const [forceFullUtr, setForceFullUtr] = useState(false);
  const [receivedAmount, setReceivedAmount] = useState('');
  const [refundSheetOpen, setRefundSheetOpen] = useState(false);

  const allActions = useMemo(() => getShopOrderActions(order), [order]);
  const actions = useMemo(() => {
    if (order.orderStatus === 'payment_unconfirmed') {
      return filterUnconfirmedActions(allActions, attestationChecked);
    }
    return allActions;
  }, [allActions, attestationChecked, order.orderStatus]);

  const showAttestation =
    order.orderStatus === 'awaiting_payment' || order.orderStatus === 'payment_unconfirmed';

  const openRefund = openRefundsForOrder(order);
  const openRefundMeta = order.refunds.find(
    (r) => r.id === openRefund?.refundId || r.status === 'due' || r.status === 'overdue',
  );

  function resetSheet() {
    setActiveAction(null);
    setPhase('form');
    setUtrLast4('');
    setFullUtr('');
    setForceFullUtr(false);
    setReceivedAmount('');
  }

  function openAction(id: ShopActionId) {
    onActionError(null);
    setActiveAction(id);
    setPhase(id === 'reject' || id === 'paid_check_no' ? 'confirm' : 'form');
  }

  function utrFields(forBalance: boolean) {
    return buildConfirmUtrFields(order, forBalance);
  }

  function resolveUtr(forBalance: boolean) {
    return confirmUtrBody({
      customerUtr: forBalance ? null : order.payment.customerUtr,
      last4: utrLast4,
      full12: fullUtr,
      forceFull12: forceFullUtr,
      balanceUtr: order.payment.balance?.utr,
      forBalance,
    });
  }

  function confirmCopy(): { title: string; body: string } {
    switch (activeAction) {
      case 'reject':
        return {
          title: 'Reject this order?',
          body: 'No payment was confirmed. The customer will be notified.',
        };
      case 'paid_check_no':
        return {
          title: 'Payment not received?',
          body: 'This will close the payment check for this cancelled order.',
        };
      case 'payment_not_found':
        return {
          title: 'Payment not found?',
          body: "Support may check this payment using the customer's UTR.",
        };
      case 'amount_differs':
        return {
          title: 'Report different amount?',
          body: `You are reporting ${formatInr(Number(receivedAmount) || 0)} received instead of the expected amount.`,
        };
      case 'closed_received_refund':
        return {
          title: 'Confirm payment received?',
          body: 'The customer will be refunded. This order will not be prepared.',
        };
      case 'late_refund':
        return {
          title: 'Refund this customer?',
          body: 'The customer will be refunded. This order will not be prepared.',
        };
      case 'late_accept':
        return {
          title: 'Accept and prepare?',
          body: 'You received a late payment. The order will move to preparing.',
        };
      case 'confirm_balance':
        return {
          title: 'Confirm balance received?',
          body: `Confirm you received the balance of ${formatInr(order.payment.balance?.amount ?? 0)}.`,
        };
      default:
        return {
          title: 'Confirm payment received?',
          body: `Confirm you received ${formatInr(order.expectedAmount ?? order.payment.amount)} and accept this order.`,
        };
    }
  }

  async function runSubmit() {
    if (!activeAction) return;
    setBusy(true);
    onActionError(null);
    try {
      if (activeAction === 'reject') {
        const result = await rejectShopOrder(order.id);
        onOrderUpdated(result.order);
        resetSheet();
        return;
      }

      if (activeAction === 'paid_check_no') {
        const result = await submitPaidCheck(order.id, { received: false });
        onOrderUpdated(result.order);
        resetSheet();
        return;
      }

      if (activeAction === 'paid_check_yes') {
        const utr = resolveUtr(false);
        if (!utr) {
          onActionError('Enter a valid UTR.');
          return;
        }
        const result = await submitPaidCheck(order.id, { received: true, ...utr });
        onOrderUpdated(result.order);
        resetSheet();
        return;
      }

      if (activeAction === 'payment_not_found') {
        const utr = resolveUtr(false);
        const result = await reportPaymentNotFound(order.id, utr ?? {});
        onOrderUpdated(result.order);
        resetSheet();
        return;
      }

      if (activeAction === 'amount_differs') {
        const amount = Number(receivedAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
          onActionError('Enter the amount you received.');
          return;
        }
        const utr = resolveUtr(false);
        const result = await reportAmountDiffers(order.id, {
          receivedAmount: amount,
          ...utr,
        });
        onOrderUpdated(result.order);
        resetSheet();
        return;
      }

      if (actionUsesConfirmPayment(activeAction)) {
        const forBalance = activeAction === 'confirm_balance';
        const utr = resolveUtr(forBalance);
        if (!utr) {
          onActionError('Enter a valid UTR.');
          return;
        }
        const body = buildConfirmPaymentBody(order, activeAction, utr, {
          attestationChecked,
        });
        if (!body) {
          onActionError('This action is not available. Refresh and try again.');
          return;
        }
        const result = await confirmOrderPayment(order.id, body);
        onOrderUpdated(result.order);
        resetSheet();
      }
    } catch (err) {
      if (err instanceof OrdersApiError && err.code === 'FULL_UTR_REQUIRED') {
        setForceFullUtr(true);
        setPhase('form');
        onActionError('Enter the full 12-digit UTR from your UPI app.');
      } else {
        onActionError(ordersErrorMessage(err, 'Could not update this order.'));
      }
    } finally {
      setBusy(false);
    }
  }

  function primaryDisabled(action: ShopActionId): boolean {
    if (action === 'confirm_received' && showAttestation && !attestationChecked) return true;
    return false;
  }

  const sheetVisible = activeAction !== null;
  const forBalance = activeAction === 'confirm_balance';
  const fieldMode = utrFields(forBalance);
  const needsUtrForm =
    activeAction &&
    activeAction !== 'reject' &&
    activeAction !== 'paid_check_no' &&
    (actionUsesConfirmPayment(activeAction) ||
      activeAction === 'payment_not_found' ||
      activeAction === 'amount_differs' ||
      activeAction === 'paid_check_yes');

  return (
    <>
      {openRefund ? (
        <View style={styles.refundCard}>
          <Text style={styles.refundCardTitle}>Refund due</Text>
          <Text style={styles.refundCardBody}>
            {formatInr(openRefund.amount)}
            {openRefundMeta?.reason ? ` — ${refundReasonCopy(openRefundMeta.reason)}` : ''}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setRefundSheetOpen(true)}
            style={styles.refundCardBtn}>
            <Text style={styles.refundCardBtnLabel}>Send refund</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push('/(app)/(refunds)')}>
            <Text style={styles.refundLink}>View all refunds due</Text>
          </Pressable>
        </View>
      ) : null}

      {showAttestation && actions.length > 0 ? (
        <AttestationCheckbox
          checked={attestationChecked}
          onChange={setAttestationChecked}
          disabled={busy}
        />
      ) : null}

      {actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map((action) => (
            <Pressable
              key={action.id}
              accessibilityRole="button"
              disabled={busy || primaryDisabled(action.id)}
              onPress={() => openAction(action.id)}
              style={({ pressed }) => [
                action.variant === 'primary' ? styles.primary : styles.secondaryBtn,
                action.variant === 'danger' && styles.dangerBtn,
                (busy || primaryDisabled(action.id)) && styles.disabled,
                pressed && styles.pressed,
              ]}>
              {busy ? (
                <ActivityIndicator color={action.variant === 'primary' ? colors.white : colors.primary} />
              ) : (
                <Text
                  style={[
                    action.variant === 'primary' ? styles.primaryLabel : styles.secondaryLabel,
                    action.variant === 'danger' && styles.dangerLabel,
                  ]}>
                  {action.label}
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      ) : null}

      {sheetVisible ? (
        <ConfirmBottomSheet
          visible
          title={phase === 'confirm' ? confirmCopy().title : confirmCopy().title}
          body={phase === 'confirm' ? confirmCopy().body : undefined}
          primaryLabel={phase === 'confirm' ? (busy ? 'Saving…' : 'Confirm') : 'Continue'}
          primaryDisabled={
            phase === 'form' &&
            activeAction === 'amount_differs' &&
            (!receivedAmount || !Number.isFinite(Number(receivedAmount)))
          }
          onPrimary={() => {
            if (phase === 'form' && needsUtrForm) {
              if (activeAction === 'amount_differs' && !receivedAmount) return;
              setPhase('confirm');
              return;
            }
            runSubmit();
          }}
          onClose={() => !busy && resetSheet()}
          busy={busy}>
          {phase === 'form' && activeAction === 'amount_differs' ? (
            <AppTextInput
              value={receivedAmount}
              onChangeText={setReceivedAmount}
              placeholder="Amount received"
              placeholderTextColor={colors.textPlaceholder}
              keyboardType="decimal-pad"
              style={styles.input}
            />
          ) : null}
          {phase === 'form' && needsUtrForm ? (
            <UtrInputBlock
              mode={fieldMode}
              last4={utrLast4}
              full12={fullUtr}
              onLast4Change={setUtrLast4}
              onFull12Change={setFullUtr}
              showFull12={forceFullUtr}
              disabled={busy}
            />
          ) : null}
        </ConfirmBottomSheet>
      ) : null}

      {openRefund && refundSheetOpen ? (
        <MarkRefundSentSheet
          visible
          orderId={order.id}
          refundId={openRefund.refundId}
          amount={openRefund.amount}
          customerUpiId={
            order.refunds.find((r) => r.id === openRefund.refundId)?.customerUpiId ??
            order.payment.customerUpiId
          }
          onClose={() => setRefundSheetOpen(false)}
          onSuccess={() => {
            setRefundSheetOpen(false);
            onRefundSent?.();
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm },
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
    fontFamily: typography.fonts.semibold,
    color: colors.white,
    textAlign: 'center',
  },
  secondaryBtn: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.tintSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontSize: typography.sizes.body,
    fontFamily: typography.fonts.semibold,
    color: colors.heading,
  },
  dangerBtn: {
    backgroundColor: 'transparent',
  },
  dangerLabel: {
    color: colors.error,
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.9 },
  input: {
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
  refundCard: {
    backgroundColor: colors.overlayPrimary,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
  refundCardTitle: {
    fontFamily: typography.fonts.semibold,
    fontSize: typography.sizes.body,
    color: colors.error,
  },
  refundCardBody: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.body,
    color: colors.heading,
  },
  refundCardBtn: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refundCardBtnLabel: {
    fontFamily: typography.fonts.semibold,
    color: colors.white,
  },
  refundLink: {
    fontFamily: typography.fonts.semibold,
    fontSize: typography.sizes.body,
    color: colors.primary,
    textAlign: 'center',
  },
});
