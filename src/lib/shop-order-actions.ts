import type { ConfirmUtrBody } from '@/lib/utr-validation';
import {
  hasBalanceUtr,
  isPaidCheckPending,
  paymentStatusForLabel,
  type ShopOrder,
} from '@/lib/shop-order-types';

export type ShopActionId =
  | 'confirm_received'
  | 'confirm_balance'
  | 'amount_differs'
  | 'payment_not_found'
  | 'reject'
  | 'late_accept'
  | 'late_refund'
  | 'closed_received_refund'
  | 'paid_check_yes'
  | 'paid_check_no'
  | 'mark_refund';

export type ShopActionVariant = 'primary' | 'danger' | 'secondary';

export type ShopOrderAction = {
  id: ShopActionId;
  label: string;
  variant: ShopActionVariant;
  requiresAttestation: boolean;
  opensSheet: boolean;
};

export type ConfirmPaymentBody = {
  withinWindowAttested: boolean;
  fulfil?: boolean;
  utrLast4?: string;
  fullUtr?: string;
};

export type PaymentFormState = {
  attestationChecked: boolean;
  utrLast4: string;
  fullUtr: string;
  forceFullUtr: boolean;
  receivedAmount?: string;
};

export function canReject(order: ShopOrder): boolean {
  if (order.orderStatus !== 'awaiting_payment') return false;
  const utr = order.payment.customerUtr?.trim();
  return !utr;
}

export function isClosedLatePaymentRefund(order: ShopOrder): boolean {
  if (order.orderStatus !== 'cancelled') return false;
  const closed = order.closedReason?.trim();
  return closed === 'unconfirmed_expired' || closed === 'payment_not_verified';
}

export function getShopOrderActions(order: ShopOrder, _now: Date = new Date()): ShopOrderAction[] {
  const status = order.orderStatus;
  const pay = paymentStatusForLabel(order);

  if (status === 'awaiting_payment') {
    if (pay === 'short') {
      if (!hasBalanceUtr(order)) return [];
      return [
        {
          id: 'confirm_balance',
          label: 'Confirm balance received',
          variant: 'primary',
          requiresAttestation: false,
          opensSheet: true,
        },
      ];
    }

    const actions: ShopOrderAction[] = [
      {
        id: 'confirm_received',
        label: 'Payment received',
        variant: 'primary',
        requiresAttestation: true,
        opensSheet: true,
      },
      {
        id: 'amount_differs',
        label: 'Amount differs',
        variant: 'secondary',
        requiresAttestation: false,
        opensSheet: true,
      },
    ];

    if (order.payment.customerUtr?.trim()) {
      actions.push({
        id: 'payment_not_found',
        label: 'Payment not found',
        variant: 'secondary',
        requiresAttestation: false,
        opensSheet: true,
      });
    } else if (canReject(order)) {
      actions.push({
        id: 'reject',
        label: 'Reject order',
        variant: 'danger',
        requiresAttestation: false,
        opensSheet: true,
      });
    }

    return actions;
  }

  if (status === 'payment_unconfirmed') {
    return [
      {
        id: 'confirm_received',
        label: 'Payment received',
        variant: 'primary',
        requiresAttestation: true,
        opensSheet: true,
      },
      {
        id: 'late_accept',
        label: 'Accept and prepare',
        variant: 'primary',
        requiresAttestation: false,
        opensSheet: true,
      },
      {
        id: 'late_refund',
        label: 'Refund customer',
        variant: 'secondary',
        requiresAttestation: false,
        opensSheet: true,
      },
    ];
  }

  if (status === 'payment_review') {
    return [
      {
        id: 'confirm_received',
        label: 'Payment received',
        variant: 'primary',
        requiresAttestation: false,
        opensSheet: true,
      },
      {
        id: 'amount_differs',
        label: 'Amount differs',
        variant: 'secondary',
        requiresAttestation: false,
        opensSheet: true,
      },
      {
        id: 'payment_not_found',
        label: 'Payment not found',
        variant: 'secondary',
        requiresAttestation: false,
        opensSheet: true,
      },
    ];
  }

  if (status === 'cancelled') {
    if (isPaidCheckPending(order)) {
      return [
        {
          id: 'paid_check_yes',
          label: 'Yes, I received it',
          variant: 'primary',
          requiresAttestation: false,
          opensSheet: true,
        },
        {
          id: 'paid_check_no',
          label: 'No, not received',
          variant: 'secondary',
          requiresAttestation: false,
          opensSheet: true,
        },
      ];
    }

    if (isClosedLatePaymentRefund(order)) {
      return [
        {
          id: 'closed_received_refund',
          label: 'I received this payment',
          variant: 'primary',
          requiresAttestation: false,
          opensSheet: true,
        },
      ];
    }
  }

  return [];
}

/** Which actions are enabled for payment_unconfirmed based on attestation checkbox. */
export function filterUnconfirmedActions(
  actions: ShopOrderAction[],
  attestationChecked: boolean,
): ShopOrderAction[] {
  if (!actions.some((a) => a.id === 'late_accept')) return actions;

  if (attestationChecked) {
    return actions.filter((a) => a.id === 'confirm_received');
  }
  return actions.filter((a) => a.id === 'late_accept' || a.id === 'late_refund');
}

export function buildConfirmPaymentBody(
  order: ShopOrder,
  actionId: ShopActionId,
  utr: ConfirmUtrBody,
  form: Pick<PaymentFormState, 'attestationChecked'>,
): ConfirmPaymentBody | null {
  switch (actionId) {
    case 'confirm_received':
      if (order.orderStatus === 'awaiting_payment') {
        return { ...utr, withinWindowAttested: true };
      }
      if (order.orderStatus === 'payment_unconfirmed') {
        if (!form.attestationChecked) return null;
        return { ...utr, withinWindowAttested: true };
      }
      if (order.orderStatus === 'payment_review') {
        return { ...utr, withinWindowAttested: false };
      }
      return null;

    case 'confirm_balance':
      if (order.orderStatus !== 'awaiting_payment') return null;
      return { ...utr, withinWindowAttested: true };

    case 'late_accept':
      if (order.orderStatus !== 'payment_unconfirmed') return null;
      return { ...utr, withinWindowAttested: false, fulfil: true };

    case 'late_refund':
      if (order.orderStatus !== 'payment_unconfirmed') return null;
      return { ...utr, withinWindowAttested: false, fulfil: false };

    case 'closed_received_refund':
      if (!isClosedLatePaymentRefund(order)) return null;
      return { ...utr, withinWindowAttested: false };

    default:
      return null;
  }
}

export function actionUsesConfirmPayment(actionId: ShopActionId): boolean {
  return (
    actionId === 'confirm_received' ||
    actionId === 'confirm_balance' ||
    actionId === 'late_accept' ||
    actionId === 'late_refund' ||
    actionId === 'closed_received_refund'
  );
}

export function orderNeedsWarningPill(order: ShopOrder): boolean {
  const status = order.orderStatus;
  return (
    status === 'payment_unconfirmed' ||
    status === 'payment_review' ||
    order.hasOpenRefund === true ||
    showRefundDueOnOrder(order)
  );
}

export function showRefundDueOnOrder(order: ShopOrder): boolean {
  if (order.hasOpenRefund) return true;
  return order.refunds.some((r) => r.status === 'due' || r.status === 'overdue');
}

export function openRefundsForOrder(order: ShopOrder): { refundId: string; amount: number } | null {
  const open = order.refunds.find(
    (r) => r.status === 'due' || r.status === 'overdue' || r.status === 'upi_needed',
  );
  if (!open || open.amount == null) return null;
  return { refundId: open.id, amount: open.amount };
}
