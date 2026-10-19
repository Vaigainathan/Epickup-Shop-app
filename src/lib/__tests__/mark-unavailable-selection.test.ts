import { describe, expect, it } from '@jest/globals';

import {
  markableLineIds,
  orderItemLineId,
  validateMarkUnavailableSelection,
} from '@/lib/mark-unavailable-selection';
import type { ShopOrder, ShopOrderItem } from '@/lib/shop-order-types';

function item(partial: Partial<ShopOrderItem> & { name: string }): ShopOrderItem {
  return {
    id: partial.id ?? null,
    productId: partial.productId ?? 'p1',
    variantId: partial.variantId ?? null,
    name: partial.name,
    price: partial.price ?? 10,
    qty: partial.qty ?? 1,
    unavailable: partial.unavailable ?? false,
  };
}

function preparingOrder(items: ShopOrderItem[]): ShopOrder {
  return {
    id: 'o1',
    displayId: 1,
    handoverOtp: null,
    items,
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
    stockShort: true,
    stockShortOpen: true,
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
}

describe('orderItemLineId', () => {
  it('uses item.id when non-empty', () => {
    expect(orderItemLineId(item({ id: 'abc-123', name: 'A' }), 0)).toBe('abc-123');
  });

  it('uses line{index} when id missing', () => {
    expect(orderItemLineId(item({ id: null, name: 'A' }), 0)).toBe('line0');
    expect(orderItemLineId(item({ id: '', name: 'B' }), 2)).toBe('line2');
  });
});

describe('mark-unavailable-selection', () => {
  it('includes line index ids in markable set', () => {
    const order = preparingOrder([
      item({ id: 'line-1', name: 'A' }),
      item({ id: null, name: 'B' }),
    ]);
    expect(markableLineIds(order)).toEqual(['line-1', 'line1']);
  });

  it('validates selection against id and line index', () => {
    const order = preparingOrder([
      item({ id: 'line-1', name: 'A' }),
      item({ id: null, name: 'B' }),
    ]);
    expect(validateMarkUnavailableSelection(order, ['line1']).ok).toBe(true);
    expect(validateMarkUnavailableSelection(order, ['line0']).ok).toBe(false);
  });

  it('skips unavailable lines', () => {
    const order = preparingOrder([item({ id: null, name: 'A', unavailable: true })]);
    expect(markableLineIds(order)).toEqual([]);
  });
});
