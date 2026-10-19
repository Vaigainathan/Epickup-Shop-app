import { describe, expect, it } from '@jest/globals';

import {
  buildConfirmUtrFields,
  confirmUtrBody,
  isValidFullUtr,
  isValidUtrLast4,
} from '@/lib/utr-validation';
import type { ShopOrder } from '@/lib/shop-order-types';

function minimalOrder(overrides: Partial<ShopOrder> & { id: string }): ShopOrder {
  const base: ShopOrder = {
    id: overrides.id,
    displayId: null,
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
  return {
    ...base,
    ...overrides,
    payment: { ...base.payment, ...overrides.payment },
  };
}

describe('utr-validation', () => {
  it('validates last4 and full12', () => {
    expect(isValidUtrLast4('1234')).toBe(true);
    expect(isValidUtrLast4('12')).toBe(false);
    expect(isValidFullUtr('123456789012')).toBe(true);
    expect(isValidFullUtr('1234')).toBe(false);
  });

  it('no customer UTR uses full12 mode', () => {
    const order = minimalOrder({ id: 'n1' });
    expect(buildConfirmUtrFields(order).mode).toBe('full12');
  });

  it('customer UTR uses last4 mode with hint', () => {
    const order = minimalOrder({
      id: 'n2',
      payment: {
        ...minimalOrder({ id: 'x' }).payment,
        customerUtr: '123456789012',
      },
    });
    const fields = buildConfirmUtrFields(order);
    expect(fields.mode).toBe('last4');
    expect(fields.hintLast4).toBe('9012');
  });

  it('confirmUtrBody without customer UTR requires full12', () => {
    expect(
      confirmUtrBody({ customerUtr: null, last4: '', full12: '123456789012' }),
    ).toEqual({ fullUtr: '123456789012' });
    expect(confirmUtrBody({ customerUtr: null, last4: '1234', full12: '' })).toBeNull();
  });
});
