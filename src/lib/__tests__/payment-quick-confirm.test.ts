import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  customerUtrLast4,
  canQuickConfirmPayment,
} from '@/lib/payment-quick-confirm';
import { buildConfirmPaymentBody } from '@/lib/shop-order-actions';
import type { ShopOrder } from '@/lib/shop-order-types';

function minimalOrder(overrides: Partial<ShopOrder> & { id: string }): ShopOrder {
  const base: ShopOrder = {
    id: overrides.id,
    displayId: 1,
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
    delivery: { stage: null },
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
      status: 'customer_claimed',
      statusRaw: 'customer_claimed',
      statusKnown: true,
      amount: 100,
      shopUpiId: null,
      customerUpiId: null,
      customerUtr: '123456789012',
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
    handedOverAt: null,
  };
  return { ...base, ...overrides };
}

describe('payment-quick-confirm', () => {
  it('extracts last4 from customer UTR', () => {
    expect(customerUtrLast4('123456789012')).toBe('9012');
  });

  it('quick confirm available for confirm_received with customer UTR', () => {
    const order = minimalOrder({ id: 'q1' });
    expect(canQuickConfirmPayment(order, 'confirm_received')).toBe(true);
    expect(canQuickConfirmPayment(order, 'reject')).toBe(false);
  });

  it('confirm body uses utrLast4 from customer UTR', () => {
    const order = minimalOrder({ id: 'q2' });
    const last4 = customerUtrLast4(order.payment.customerUtr);
    const body = buildConfirmPaymentBody(
      order,
      'confirm_received',
      { utrLast4: last4! },
      { attestationChecked: true },
    );
    expect(body).toEqual({
      utrLast4: '9012',
      withinWindowAttested: true,
    });
  });
});
