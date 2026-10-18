import { describe, expect, it } from '@jest/globals';

import { OrdersApiError, ordersErrorMessage } from '@/lib/orders-api';
import { getPushRoute, parsePushData } from '@/lib/shop-push';
import {
  hasBalanceUtr,
  mergeAwaitingPaymentOrders,
  parseOrder,
  shopOrderLabelDetail,
  shopOrderLabelShort,
  type ShopOrder,
} from '@/lib/shop-order-types';

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
    createdAt: new Date('2026-01-01T10:00:00Z'),
    updatedAt: null,
  };
  return { ...base, ...overrides };
}

describe('parseOrder', () => {
  it('keeps unknown orderStatus', () => {
    const order = parseOrder({ id: 'o1', orderStatus: 'future_status', items: [] });
    expect(order).not.toBeNull();
    expect(order!.orderStatusKnown).toBe(false);
    expect(order!.orderStatusRaw).toBe('future_status');
    expect(order!.orderStatus).toBeNull();
  });

  it('parses with missing optional fields', () => {
    const order = parseOrder({ id: 'o2', orderStatus: 'preparing' });
    expect(order).not.toBeNull();
    expect(order!.customerName).toBeNull();
    expect(order!.payment.balance).toBeNull();
  });

  it('keeps initiated payment status raw', () => {
    const order = parseOrder({
      id: 'o3',
      orderStatus: 'awaiting_payment',
      payment: { status: 'initiated', amount: 50 },
    });
    expect(order!.payment.statusRaw).toBe('initiated');
    expect(order!.payment.statusKnown).toBe(false);
  });
});

describe('hasBalanceUtr', () => {
  it('true when payment.balance.utr is non-empty', () => {
    const order = minimalOrder({
      id: 'b1',
      payment: {
        ...minimalOrder({ id: 'x' }).payment,
        status: 'short',
        statusRaw: 'short',
        balance: { amount: 10, dueBy: null, utr: '123456789012' },
      },
    });
    expect(hasBalanceUtr(order)).toBe(true);
  });

  it('false when utr missing or empty', () => {
    const order = minimalOrder({
      id: 'b2',
      payment: {
        ...minimalOrder({ id: 'x' }).payment,
        status: 'short',
        statusRaw: 'short',
        balance: { amount: 10, dueBy: null, utr: '' },
      },
    });
    expect(hasBalanceUtr(order)).toBe(false);
  });
});

type LabelShortCase = {
  name: string;
  order: Partial<ShopOrder> & { id: string };
  short: string;
};

describe('shopOrderLabelShort', () => {
  const cases: LabelShortCase[] = [
    {
      name: 'unknown status',
      order: { id: 'u1', orderStatus: null, orderStatusKnown: false, orderStatusRaw: 'x' },
      short: 'Needs attention',
    },
    {
      name: 'incoming payment',
      order: {
        id: 'u2',
        payment: { ...minimalOrder({ id: 'x' }).payment, status: 'pending', statusRaw: 'pending' },
      },
      short: 'Incoming payment',
    },
    {
      name: 'initiated like pending',
      order: {
        id: 'u3',
        payment: {
          ...minimalOrder({ id: 'x' }).payment,
          status: null,
          statusKnown: false,
          statusRaw: 'initiated',
        },
      },
      short: 'Incoming payment',
    },
    {
      name: 'UTR entered',
      order: {
        id: 'u4',
        payment: {
          ...minimalOrder({ id: 'x' }).payment,
          status: 'customer_claimed',
          statusRaw: 'customer_claimed',
        },
      },
      short: 'UTR entered',
    },
    {
      name: 'amount short',
      order: {
        id: 'u5',
        payment: {
          ...minimalOrder({ id: 'x' }).payment,
          status: 'short',
          statusRaw: 'short',
          balance: { amount: 5, dueBy: null, utr: null },
        },
      },
      short: 'Amount short',
    },
    {
      name: 'balance sent',
      order: {
        id: 'u6',
        payment: {
          ...minimalOrder({ id: 'x' }).payment,
          status: 'short',
          statusRaw: 'short',
          balance: { amount: 5, dueBy: null, utr: '999999999999' },
        },
      },
      short: 'Balance sent',
    },
    {
      name: 'not confirmed',
      order: { id: 'u7', orderStatus: 'payment_unconfirmed', orderStatusRaw: 'payment_unconfirmed' },
      short: 'Not confirmed',
    },
    {
      name: 'under review',
      order: { id: 'u8', orderStatus: 'payment_review', orderStatusRaw: 'payment_review' },
      short: 'Under review',
    },
    {
      name: 'check payment',
      order: {
        id: 'u9',
        orderStatus: 'cancelled',
        orderStatusRaw: 'cancelled',
        cancellation: { reason: null, shopReason: null, paidCheck: { status: 'pending', received: null }, cancelledAt: null },
      },
      short: 'Check payment',
    },
    {
      name: 'closed unconfirmed',
      order: {
        id: 'u10',
        orderStatus: 'cancelled',
        orderStatusRaw: 'cancelled',
        closedReason: 'unconfirmed_expired',
      },
      short: 'Closed',
    },
    {
      name: 'balance not paid',
      order: {
        id: 'u11',
        orderStatus: 'cancelled',
        orderStatusRaw: 'cancelled',
        closedReason: 'balance_expired',
      },
      short: 'Balance not paid',
    },
    {
      name: 'preparing',
      order: { id: 'u12', orderStatus: 'preparing', orderStatusRaw: 'preparing' },
      short: 'Preparing',
    },
    {
      name: 'delivery failed',
      order: { id: 'u13', orderStatus: 'delivery_failed', orderStatusRaw: 'delivery_failed' },
      short: 'Needs attention',
    },
  ];

  it.each(cases)('$name', (row: LabelShortCase) => {
    expect(shopOrderLabelShort(minimalOrder(row.order))).toBe(row.short);
  });
});

describe('shopOrderLabelDetail', () => {
  it('unknown status detail', () => {
    const order = minimalOrder({
      id: 'd1',
      orderStatus: null,
      orderStatusKnown: false,
      orderStatusRaw: 'x',
    });
    expect(shopOrderLabelDetail(order)).toContain('needs attention');
  });

  it('balance sent detail', () => {
    const order = minimalOrder({
      id: 'd2',
      payment: {
        ...minimalOrder({ id: 'x' }).payment,
        status: 'short',
        statusRaw: 'short',
        balance: { amount: 1, dueBy: null, utr: '111111111111' },
      },
    });
    expect(shopOrderLabelDetail(order)).toContain('balance');
  });
});

describe('mergeAwaitingPaymentOrders', () => {
  it('dedupes by id and sorts newest first', () => {
    const older = minimalOrder({
      id: 'same',
      createdAt: new Date('2026-01-01T08:00:00Z'),
    });
    const newer = minimalOrder({
      id: 'same',
      createdAt: new Date('2026-01-02T08:00:00Z'),
      customerName: 'Newer',
    });
    const other = minimalOrder({
      id: 'other',
      createdAt: new Date('2026-01-03T08:00:00Z'),
    });
    const merged = mergeAwaitingPaymentOrders([[older, other], [newer]]);
    expect(merged).toHaveLength(2);
    expect(merged[0].id).toBe('other');
    expect(merged.find((o) => o.id === 'same')?.customerName).toBe('Newer');
  });
});

describe('getPushRoute', () => {
  const orderTypes: string[] = [
    'incoming_payment',
    'utr_submitted',
    'payment_reminder',
    'payment_review_shop',
    'review_resolved',
    'customer_cancelled',
    'refund_due',
    'refund_overdue',
    'balance_not_paid_shop',
  ];

  it.each(orderTypes)('routes %s to order when orderId set', (type: string) => {
    const route = getPushRoute(parsePushData({ type, orderId: 'abc' }));
    expect(route).toEqual({ kind: 'order', orderId: 'abc' });
  });

  it('unknown type ignored', () => {
    expect(getPushRoute(parsePushData({ type: 'parcel_update', orderId: 'x' }))).toEqual({
      kind: 'ignore',
    });
  });

  it('missing orderId goes to list', () => {
    expect(getPushRoute(parsePushData({ type: 'incoming_payment' }))).toEqual({
      kind: 'orders_list',
    });
  });
});

describe('ordersErrorMessage', () => {
  it('default never returns server message', () => {
    const err = new OrdersApiError('Secret server detail', 500, 'SOME_NEW_CODE');
    const msg = ordersErrorMessage(err, 'Fallback');
    expect(msg).toBe('Something went wrong. Try again.');
    expect(msg).not.toContain('Secret');
  });

  it('401 uses session copy', () => {
    const err = new OrdersApiError('ignored', 401, 'UNAUTHENTICATED');
    expect(ordersErrorMessage(err, 'x')).toContain('session expired');
  });
});
