import { describe, expect, it } from '@jest/globals';

import {
  isWaitingForDeliveryPartner,
  shopDeliveryPartnerMessage,
  shopPickedUpTime,
  shouldShowDeliveryPartnerCard,
  shouldShowDriverCard,
} from '@/lib/shop-order-handover';
import type { ShopOrder } from '@/lib/shop-order-types';

function minimalOrder(overrides: Partial<ShopOrder> & { id: string }): ShopOrder {
  const base: ShopOrder = {
    id: overrides.id,
    displayId: 42,
    items: [],
    itemsTotal: 100,
    deliveryFee: 0,
    deliveryAddress: null,
    deliveryAddressText: '',
    orderStatus: 'ready',
    orderStatusRaw: 'ready',
    orderStatusKnown: true,
    linkedBookingId: null,
    driverInfo: null,
    customerName: null,
    payerUpiName: null,
    customerNote: null,
    delivery: { stage: 'searching' },
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
    handedOverAt: null,
    createdAt: new Date('2026-01-01T10:00:00Z'),
    updatedAt: new Date('2026-01-01T11:00:00Z'),
  };
  return { ...base, ...overrides };
}

describe('shop-order-handover', () => {
  it('shows card for ready and handed_over', () => {
    expect(shouldShowDeliveryPartnerCard(minimalOrder({ id: '1' }))).toBe(true);
    expect(
      shouldShowDeliveryPartnerCard(
        minimalOrder({ id: '2', orderStatus: 'handed_over', orderStatusRaw: 'handed_over' }),
      ),
    ).toBe(true);
    expect(
      shouldShowDeliveryPartnerCard(
        minimalOrder({ id: '3', orderStatus: 'preparing', orderStatusRaw: 'preparing' }),
      ),
    ).toBe(false);
  });

  it('waiting copy when ready and searching', () => {
    const order = minimalOrder({ id: 'w' });
    expect(isWaitingForDeliveryPartner(order)).toBe(true);
    expect(shopDeliveryPartnerMessage(order)).toBe('Waiting for a delivery partner');
    expect(shouldShowDriverCard(order)).toBe(false);
  });

  it('assigned message and driver card when driverInfo present', () => {
    const order = minimalOrder({
      id: 'a',
      delivery: { stage: 'assigned' },
      driverInfo: { name: 'Raj', phone: '999', vehicle: 'TN01', photoUrl: null },
    });
    expect(shopDeliveryPartnerMessage(order)).toBe('On the way to your shop');
    expect(shouldShowDriverCard(order)).toBe(true);
  });

  it('at_shop message includes display id', () => {
    const order = minimalOrder({
      id: 's',
      displayId: 7,
      delivery: { stage: 'at_shop' },
      driverInfo: { name: 'Raj', phone: '999', vehicle: 'TN01', photoUrl: null },
    });
    expect(shopDeliveryPartnerMessage(order)).toBe(
      'Delivery partner has arrived — hand over order #00007',
    );
  });

  it('picked up uses handedOverAt then updatedAt', () => {
    const handed = new Date('2026-02-01T12:30:00Z');
    const order = minimalOrder({
      id: 'p',
      orderStatus: 'handed_over',
      orderStatusRaw: 'handed_over',
      handedOverAt: handed,
      driverInfo: { name: 'Priya', phone: '888', vehicle: 'KA02', photoUrl: null },
    });
    expect(shopPickedUpTime(order)).toEqual(handed);
    expect(shopDeliveryPartnerMessage(order)).toContain('Picked up by Priya at');
  });
});
