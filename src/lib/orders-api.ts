import { apiUrl } from '@/lib/api';
import { getSessionToken } from '@/lib/session';

type JsonRecord = Record<string, unknown>;

export class OrdersApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = 'OrdersApiError';
    this.status = status;
    this.code = code;
  }
}

export type ShopOrderStatus =
  | 'awaiting_payment'
  | 'preparing'
  | 'ready'
  | 'handed_over'
  | 'completed'
  | 'cancelled';

export type ShopPaymentStatus =
  | 'pending'
  | 'initiated'
  | 'customer_claimed'
  | 'confirmed'
  | 'expired'
  | 'refund_pending'
  | 'refunded';

export type ShopOrderItem = {
  productId: string | null;
  variantId: string | null;
  name: string;
  price: number;
  qty: number;
};

export type ShopOrderDriverInfo = {
  name: string;
  phone: string;
  vehicle: string;
};

export type ShopOrder = {
  id: string;
  displayId: number | null;
  handoverOtp: string | null;
  items: ShopOrderItem[];
  itemsTotal: number;
  deliveryFee: number;
  deliveryAddressText: string;
  orderStatus: ShopOrderStatus;
  linkedBookingId: string | null;
  driverInfo: ShopOrderDriverInfo | null;
  payment: {
    status: ShopPaymentStatus | null;
    amount: number;
    shopUpiId: string | null;
    customerUpiId: string | null;
    confirmedAt: Date | null;
    expiredAt: Date | null;
    refundedAt: Date | null;
  };
  cancellation: {
    reason: string | null;
    cancelledAt: Date | null;
  };
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type OrderTransitionResult = {
  order: ShopOrder;
  alreadyProcessed: boolean;
  refundRequired: boolean | null;
};

export type OrdersListFilter = 'all' | 'awaiting_payment' | 'preparing' | 'ready' | 'completed';

const ORDER_STATUSES = new Set<ShopOrderStatus>([
  'awaiting_payment',
  'preparing',
  'ready',
  'handed_over',
  'completed',
  'cancelled',
]);

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' ? (value as JsonRecord) : null;
}

async function parseJson(response: Response): Promise<JsonRecord | null> {
  try {
    const body = await response.json();
    return asRecord(body);
  } catch {
    return null;
  }
}

function nestedData(body: JsonRecord | null): JsonRecord | null {
  if (!body) return null;
  return asRecord(body.data);
}

function errorCode(body: JsonRecord | null): string | null {
  if (!body) return null;
  if (typeof body.code === 'string' && body.code.length > 0) return body.code;
  if (typeof body.error === 'string' && /^[A-Z][A-Z0-9_]+$/.test(body.error)) {
    return body.error;
  }
  const error = asRecord(body.error);
  if (error && typeof error.code === 'string' && error.code.length > 0) {
    return error.code;
  }
  return null;
}

function backendMessage(body: JsonRecord | null, fallback: string): string {
  if (!body) return fallback;

  if (typeof body.error === 'string' && body.error.length > 0) {
    return body.error;
  }

  const error = asRecord(body.error);
  if (error && typeof error.message === 'string' && error.message.length > 0) {
    return error.message;
  }

  if (typeof body.message === 'string' && body.message.length > 0) {
    return body.message;
  }

  return fallback;
}

export function ordersErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof OrdersApiError)) return fallback;

  switch (error.code) {
    case 'ORDER_NOT_FOUND':
      return 'Order not found.';
    case 'INVALID_STATUS':
      return 'Invalid order filter.';
    case 'INVALID_TRANSITION':
      return error.message || 'This order cannot be updated from its current state.';
    case 'MISSING_LOCATION':
      return 'Shop pickup location and delivery coordinates are required before marking ready.';
    case 'INVALID_HANDOVER':
      return 'OTP and order ID are required.';
    case 'HANDOVER_MISMATCH':
      return 'Order ID or OTP does not match.';
    case 'MISSING_REASON':
      return 'A cancellation reason is required.';
    case 'UNAUTHENTICATED':
      return error.message || 'Your session expired. Please log in again.';
    case 'NETWORK_ERROR':
      return error.message || fallback;
    default:
      return error.message || fallback;
  }
}

function readString(record: JsonRecord | null, keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function readNumber(record: JsonRecord | null, keys: string[]): number | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function readBoolean(record: JsonRecord | null, keys: string[]): boolean | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'boolean') return value;
  }
  return null;
}

export function parseTimestamp(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const record = asRecord(value);
  if (!record) return null;
  const seconds = readNumber(record, ['_seconds', 'seconds']);
  if (seconds !== null) {
    const nanos = readNumber(record, ['_nanoseconds', 'nanoseconds']) ?? 0;
    const date = new Date(seconds * 1000 + Math.floor(nanos / 1e6));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function formatDisplayId(displayId: number | null | undefined): string {
  if (displayId == null || !Number.isFinite(displayId)) return '—';
  return `#${String(Math.trunc(displayId)).padStart(5, '0')}`;
}

export function itemCount(order: ShopOrder): number {
  return order.items.reduce((sum, item) => sum + (Number.isFinite(item.qty) ? item.qty : 0), 0);
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function relativeTime(date: Date | null): string {
  if (!date) return '';
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin === 1) return '1 min ago';
  if (diffMin < 60) return `${diffMin} mins ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr === 1) return '1 hour ago';
  if (diffHr < 24) return `${diffHr} hours ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay === 1) return '1 day ago';
  return `${diffDay} days ago`;
}

export function cancelledCopy(order: ShopOrder): string {
  if (order.payment.status === 'expired') {
    return "Payment wasn't confirmed in time";
  }
  const reason = order.cancellation.reason?.trim();
  if (reason) return reason;
  return 'Order was rejected';
}

async function authorizedRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getSessionToken();
  if (!token) {
    throw new OrdersApiError('Your session expired. Please log in again.', 401, 'UNAUTHENTICATED');
  }

  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(apiUrl(path), { ...init, headers });
}

async function requestJson(
  path: string,
  init: RequestInit,
  fallback: string,
): Promise<JsonRecord | null> {
  let response: Response;
  try {
    response = await authorizedRequest(path, init);
  } catch (error) {
    if (error instanceof OrdersApiError) throw error;
    throw new OrdersApiError(fallback, 0, 'NETWORK_ERROR');
  }

  const body = await parseJson(response);
  if (!response.ok) {
    throw new OrdersApiError(backendMessage(body, fallback), response.status, errorCode(body));
  }

  return body;
}

function parseItem(value: unknown): ShopOrderItem | null {
  const record = asRecord(value);
  if (!record) return null;
  const name = readString(record, ['name']) ?? 'Item';
  const price = readNumber(record, ['price']) ?? 0;
  const qty = readNumber(record, ['qty', 'quantity']) ?? 0;
  return {
    productId: readString(record, ['productId']),
    variantId: readString(record, ['variantId']),
    name,
    price,
    qty,
  };
}

function parseDriverInfo(value: unknown): ShopOrderDriverInfo | null {
  const record = asRecord(value);
  if (!record) return null;
  const name = readString(record, ['name']) ?? '';
  const phone = readString(record, ['phone']) ?? '';
  const vehicle = readString(record, ['vehicle', 'vehicleNumber']) ?? '';
  if (!name && !phone && !vehicle) return null;
  return { name, phone, vehicle };
}

function parseOrderStatus(value: string | null): ShopOrderStatus | null {
  if (!value) return null;
  return ORDER_STATUSES.has(value as ShopOrderStatus) ? (value as ShopOrderStatus) : null;
}

function parsePaymentStatus(value: string | null): ShopPaymentStatus | null {
  if (!value) return null;
  const allowed: ShopPaymentStatus[] = [
    'pending',
    'initiated',
    'customer_claimed',
    'confirmed',
    'expired',
    'refund_pending',
    'refunded',
  ];
  return allowed.includes(value as ShopPaymentStatus) ? (value as ShopPaymentStatus) : null;
}

function parseOrder(value: unknown): ShopOrder | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = readString(record, ['id']);
  const orderStatus = parseOrderStatus(readString(record, ['orderStatus']));
  if (!id || !orderStatus) return null;

  const payment = asRecord(record.payment) ?? {};
  const cancellation = asRecord(record.cancellation) ?? {};
  const address = asRecord(record.deliveryAddress);
  const itemsRaw = Array.isArray(record.items) ? record.items : [];
  const items = itemsRaw.map(parseItem).filter((item): item is ShopOrderItem => item !== null);
  const itemsTotal = readNumber(record, ['itemsTotal']) ?? 0;
  const paymentAmount = readNumber(payment, ['amount']) ?? itemsTotal;

  return {
    id,
    displayId: readNumber(record, ['displayId']),
    handoverOtp: readString(record, ['handoverOtp']),
    items,
    itemsTotal,
    deliveryFee: readNumber(record, ['deliveryFee']) ?? 0,
    deliveryAddressText: readString(address, ['text']) ?? '',
    orderStatus,
    linkedBookingId: readString(record, ['linkedBookingId']),
    driverInfo: parseDriverInfo(record.driverInfo),
    payment: {
      status: parsePaymentStatus(readString(payment, ['status'])),
      amount: paymentAmount,
      shopUpiId: readString(payment, ['shopUpiId', 'upiId']),
      customerUpiId: readString(payment, ['customerUpiId']),
      confirmedAt: parseTimestamp(payment.confirmedAt),
      expiredAt: parseTimestamp(payment.expiredAt),
      refundedAt: parseTimestamp(payment.refundedAt),
    },
    cancellation: {
      reason: readString(cancellation, ['reason']),
      cancelledAt: parseTimestamp(cancellation.cancelledAt),
    },
    createdAt: parseTimestamp(record.createdAt),
    updatedAt: parseTimestamp(record.updatedAt),
  };
}

function parseTransition(body: JsonRecord | null, fallback: string): OrderTransitionResult {
  const data = nestedData(body) ?? body;
  const order = parseOrder(data?.order);
  if (!order) {
    throw new OrdersApiError(fallback, 500, 'INVALID_RESPONSE');
  }
  const message = typeof body?.message === 'string' ? body.message : '';
  const refundRequired = readBoolean(data, ['refundRequired']);
  return {
    order,
    alreadyProcessed: message === 'Already processed',
    refundRequired,
  };
}

export async function fetchShopOrders(filter: OrdersListFilter = 'all'): Promise<ShopOrder[]> {
  const query = filter === 'all' ? '' : `?status=${encodeURIComponent(filter)}`;
  const body = await requestJson(
    `/api/shop/orders${query}`,
    { method: 'GET' },
    'Could not load orders.',
  );
  const data = nestedData(body) ?? body;
  const raw = Array.isArray(data?.orders) ? data.orders : Array.isArray(body?.orders) ? body.orders : [];
  return raw.map(parseOrder).filter((order): order is ShopOrder => order !== null);
}

export async function fetchShopOrder(id: string): Promise<ShopOrder> {
  const body = await requestJson(
    `/api/shop/orders/${encodeURIComponent(id)}`,
    { method: 'GET' },
    'Could not load this order.',
  );
  const data = nestedData(body) ?? body;
  const order = parseOrder(data?.order ?? data);
  if (!order) {
    throw new OrdersApiError('Order not found.', 404, 'ORDER_NOT_FOUND');
  }
  return order;
}

async function postTransition(id: string, action: string, payload?: JsonRecord): Promise<OrderTransitionResult> {
  const fallback = 'Could not update this order.';
  const body = await requestJson(
    `/api/shop/orders/${encodeURIComponent(id)}/${action}`,
    {
      method: 'POST',
      body: payload ? JSON.stringify(payload) : undefined,
    },
    fallback,
  );
  return parseTransition(body, fallback);
}

export async function confirmOrderPayment(id: string): Promise<OrderTransitionResult> {
  return postTransition(id, 'confirm-payment');
}

export async function rejectShopOrder(id: string): Promise<OrderTransitionResult> {
  return postTransition(id, 'reject');
}

export async function markOrderReady(id: string): Promise<OrderTransitionResult> {
  return postTransition(id, 'mark-ready');
}

export async function confirmOrderHandover(
  id: string,
  otp: string,
  displayId: number | string,
): Promise<OrderTransitionResult> {
  return postTransition(id, 'confirm-handover', { otp, displayId });
}

export async function cancelShopOrder(id: string, reason: string): Promise<OrderTransitionResult> {
  return postTransition(id, 'cancel', { reason });
}

export async function markRefundSent(id: string): Promise<OrderTransitionResult> {
  return postTransition(id, 'refund-sent');
}
