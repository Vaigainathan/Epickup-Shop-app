import { describe, expect, it } from '@jest/globals';

import { canShopCancelOrder } from '@/lib/shop-order-cancel';
import type { ShopOrder } from '@/lib/shop-order-types';

function order(overrides: Partial<ShopOrder> & { id: string }): ShopOrder {
  const base: ShopOrder = {
    id: overrides.id,
    displayId: 1,
    handoverOtp: null,
    items: [],
    itemsTotal: 100,
    deliveryFee: 0,
    deliveryAddress: null,
    deliveryAddressText: '',
    orderStatus: 'preparing',
    orderStatusRaw: 'preparing',
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
      status: 'confirmed',
      statusRaw: 'confirmed',
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

describe('canShopCancelOrder', () => {
  it('allows preparing', () => {
    expect(canShopCancelOrder(order({ id: '1', orderStatus: 'preparing' }))).toBe(true);
  });

  it('allows ready while searching', () => {
    expect(
      canShopCancelOrder(
        order({ id: '1', orderStatus: 'ready', delivery: { stage: 'searching' } }),
      ),
    ).toBe(true);
  });

  it('blocks ready after partner assigned', () => {
    expect(
      canShopCancelOrder(order({ id: '1', orderStatus: 'ready', delivery: { stage: 'assigned' } })),
    ).toBe(false);
  });

  it('blocks payment_review', () => {
    expect(canShopCancelOrder(order({ id: '1', orderStatus: 'payment_review' }))).toBe(false);
  });

  it('blocks awaiting_payment', () => {
    expect(canShopCancelOrder(order({ id: '1', orderStatus: 'awaiting_payment' }))).toBe(false);
  });
});
