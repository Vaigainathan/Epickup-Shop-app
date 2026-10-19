export const SHOP_PUSH_TYPES = [
  'incoming_payment',
  'utr_submitted',
  'payment_reminder',
  'payment_review_shop',
  'review_resolved',
  'customer_cancelled',
  'refund_due',
  'refund_overdue',
  'balance_not_paid_shop',
] as const;

export type ShopPushType = (typeof SHOP_PUSH_TYPES)[number];

export type ShopPushData = {
  type: string;
  orderId: string | null;
  displayId: string | null;
  shopName: string | null;
  action: string | null;
};

export type PushRoute =
  | { kind: 'order'; orderId: string }
  | { kind: 'refunds_list'; orderId?: string }
  | { kind: 'orders_list' }
  | { kind: 'ignore' };

const ORDER_ACTION_TYPES = new Set<string>([
  'incoming_payment',
  'utr_submitted',
  'payment_reminder',
  'payment_review_shop',
  'review_resolved',
  'customer_cancelled',
]);

const REFUND_ACTION_TYPES = new Set<string>([
  'refund_due',
  'refund_overdue',
  'balance_not_paid_shop',
]);

export function parsePushData(data: Record<string, unknown> | null | undefined): ShopPushData {
  const type = typeof data?.type === 'string' ? data.type : '';
  const orderId = typeof data?.orderId === 'string' && data.orderId.length > 0 ? data.orderId : null;
  const displayId = typeof data?.displayId === 'string' ? data.displayId : null;
  const shopName = typeof data?.shopName === 'string' ? data.shopName : null;
  const action = typeof data?.action === 'string' ? data.action : null;
  return { type, orderId, displayId, shopName, action };
}

export function getPushRoute(data: ShopPushData): PushRoute {
  const { type, orderId } = data;
  if (!SHOP_PUSH_TYPES.includes(type as ShopPushType)) {
    return { kind: 'ignore' };
  }
  if (!orderId) {
    return { kind: 'orders_list' };
  }
  if (REFUND_ACTION_TYPES.has(type)) {
    return { kind: 'refunds_list', orderId };
  }
  if (ORDER_ACTION_TYPES.has(type)) {
    return { kind: 'order', orderId };
  }
  return { kind: 'ignore' };
}
