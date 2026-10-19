import { describe, expect, it } from '@jest/globals';

import {
  buildConfirmPaymentBody,
  getShopOrderActions,
  type ShopActionId,
} from '@/lib/shop-order-actions';
import type { ShopOrder } from '@/lib/shop-order-types';

function minimalOrder(overrides: Partial<ShopOrder> & { id: string }): ShopOrder {
  const base: ShopOrder = {
    id: overrides.id,
    displayId: 1,
    handoverOtp: null,
    items: [],
    itemsTotal: 100,
    deliveryFee: 0,
    deliveryAddress: null,
    deliveryAddressText: '',
    orderStatus: 'awaiting_payment',
    orderStatusRaw: 'awaiting_payment',
    orderStatusKnown: true,
    linkedBookingId: null,
    driverInfo: null,
    customerName: null,
    payerUpiName: null,
    customerNote: null,
    stockShort: false,
    stockShortOpen: false,
    expectedAmount: 100,
    window: { start: null, end: null },
    closedReason: null,
    hasOpenRefund: false,
    help: { hasOpenHelp: false, status: null },
    refunds: [],
    review: null,
    payment: {
      status: 'pending',
      statusRaw: 'pending',
      statusKnown: true,
      amount: 100,
      shopUpiId: null,
      customerUpiId: null,
      customerUtr: null,
      officialUtr: null,
      receivedAmount: null,
      balance: null,
      confirmedAt: null,
      expiredAt: null,
      refundedAt: null,
    },
    cancellation: {
      reason: null,
      shopReason: null,
      paidCheck: null,
      cancelledAt: null,
    },
    createdAt: null,
    updatedAt: null,
  };
  return { ...base, ...overrides };
}

const utr = { utrLast4: '1234' };

function bodyFulfil(actionId: ShopActionId, order: ShopOrder, attestation = false) {
  return buildConfirmPaymentBody(order, actionId, utr, { attestationChecked: attestation });
}

describe('getShopOrderActions', () => {
  it('short without balance UTR returns no actions', () => {
    const order = minimalOrder({
      id: 's1',
      payment: {
        ...minimalOrder({ id: 'x' }).payment,
        status: 'short',
        statusRaw: 'short',
        balance: { amount: 10, dueBy: null, utr: null },
      },
    });
    expect(getShopOrderActions(order)).toEqual([]);
  });

  it('short with balance UTR returns confirm balance only', () => {
    const order = minimalOrder({
      id: 's2',
      payment: {
        ...minimalOrder({ id: 'x' }).payment,
        status: 'short',
        statusRaw: 'short',
        balance: { amount: 10, dueBy: null, utr: '111122223333' },
      },
    });
    const ids = getShopOrderActions(order).map((a) => a.id);
    expect(ids).toEqual(['confirm_balance']);
  });

  it('payment_review includes amount differs', () => {
    const order = minimalOrder({
      id: 'pr',
      orderStatus: 'payment_review',
      orderStatusRaw: 'payment_review',
      payment: {
        ...minimalOrder({ id: 'x' }).payment,
        status: 'under_review',
        statusRaw: 'under_review',
      },
    });
    const ids = getShopOrderActions(order).map((a) => a.id);
    expect(ids).toContain('amount_differs');
  });
});

describe('buildConfirmPaymentBody fulfil rules', () => {
  it('awaiting_payment confirm has no fulfil', () => {
    const order = minimalOrder({ id: 'a1' });
    const body = bodyFulfil('confirm_received', order, true);
    expect(body?.withinWindowAttested).toBe(true);
    expect(body).not.toHaveProperty('fulfil');
  });

  it('payment_unconfirmed attested confirm has no fulfil', () => {
    const order = minimalOrder({
      id: 'u1',
      orderStatus: 'payment_unconfirmed',
      orderStatusRaw: 'payment_unconfirmed',
    });
    const body = bodyFulfil('confirm_received', order, true);
    expect(body?.withinWindowAttested).toBe(true);
    expect(body).not.toHaveProperty('fulfil');
  });

  it('late accept and refund include fulfil only on payment_unconfirmed', () => {
    const order = minimalOrder({
      id: 'u2',
      orderStatus: 'payment_unconfirmed',
      orderStatusRaw: 'payment_unconfirmed',
    });
    expect(bodyFulfil('late_accept', order)?.fulfil).toBe(true);
    expect(bodyFulfil('late_refund', order)?.fulfil).toBe(false);
  });

  it('payment_review confirm has no fulfil', () => {
    const order = minimalOrder({
      id: 'u3',
      orderStatus: 'payment_review',
      orderStatusRaw: 'payment_review',
    });
    const body = bodyFulfil('confirm_received', order);
    expect(body?.withinWindowAttested).toBe(false);
    expect(body).not.toHaveProperty('fulfil');
  });

  it('closed cancel received refund has no fulfil', () => {
    const order = minimalOrder({
      id: 'c1',
      orderStatus: 'cancelled',
      orderStatusRaw: 'cancelled',
      closedReason: 'unconfirmed_expired',
    });
    const body = bodyFulfil('closed_received_refund', order);
    expect(body?.withinWindowAttested).toBe(false);
    expect(body).not.toHaveProperty('fulfil');
  });

  it('fulfil absent for confirm_balance', () => {
    const order = minimalOrder({
      id: 'b1',
      payment: {
        ...minimalOrder({ id: 'x' }).payment,
        status: 'short',
        statusRaw: 'short',
        balance: { amount: 5, dueBy: null, utr: '999988887777' },
      },
    });
    const body = buildConfirmPaymentBody(order, 'confirm_balance', utr, { attestationChecked: false });
    expect(body).not.toHaveProperty('fulfil');
  });
});
