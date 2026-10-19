import { apiUrl } from '@/lib/api';
import { getSessionToken } from '@/lib/session';
import {
  cancelledDetailCopy,
  mergeAwaitingPaymentOrders,
  parseOrder,
  parseTimestamp,
  ShopOrder,
} from '@/lib/shop-order-types';

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

export type {
  ShopDeliveryAddress,
  ShopOrder,
  ShopOrderDriverInfo,
  ShopOrderItem,
  ShopOrderStatus,
  ShopPaymentStatus,
} from '@/lib/shop-order-types';

export type OrderTransitionResult = {
  order: ShopOrder;
  alreadyProcessed: boolean;
  refundRequired: boolean | null;
};

export type OrdersListFilter = 'all' | 'awaiting_payment' | 'preparing' | 'ready' | 'completed';

export type ConfirmPaymentPayload = {
  withinWindowAttested: boolean;
  fulfil?: boolean;
  utrLast4?: string;
  fullUtr?: string;
};

export type AmountDiffersPayload = {
  receivedAmount: number;
  utrLast4?: string;
  fullUtr?: string;
};

export type PaymentNotFoundPayload = {
  utrLast4?: string;
  fullUtr?: string;
};

export type PaidCheckPayload = {
  received: boolean;
  utrLast4?: string;
  fullUtr?: string;
};

export {
  cancelledDetailCopy,
  formatIstTime,
  hasBalanceUtr,
  mergeAwaitingPaymentOrders,
  parseOrder,
  parseTimestamp,
  shopOrderLabelDetail,
  shopOrderLabelShort,
  showRefundDuePill,
} from '@/lib/shop-order-types';

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

const GENERIC_ORDER_ERROR = 'Something went wrong. Try again.';

export function ordersErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof OrdersApiError)) return fallback;

  if (error.status === 401 || error.code === 'UNAUTHENTICATED') {
    return 'Your session expired. Please log in again.';
  }

  switch (error.code) {
    case 'ORDER_NOT_FOUND':
      return 'Order not found.';
    case 'INVALID_STATUS':
      return 'Invalid order filter.';
    case 'INVALID_TRANSITION':
      return 'This order cannot be updated from its current state.';
    case 'MISSING_LOCATION':
      return 'Shop pickup location and delivery coordinates are required before marking ready.';
    case 'INVALID_HANDOVER':
      return 'OTP and order ID are required.';
    case 'HANDOVER_MISMATCH':
      return 'Order ID or OTP does not match.';
    case 'MISSING_REASON':
      return 'A cancellation reason is required.';
    case 'FULL_UTR_REQUIRED':
      return 'Enter the full 12-digit UTR from your UPI app.';
    case 'UTR_USED':
      return 'This UTR is already linked to another order. Check the number and try again.';
    case 'INVALID_STATE':
      return "This action isn't available for this order right now. Refresh and try again.";
    case 'AMOUNT_DIFFERS_UNAVAILABLE':
      return "Amount differs can't be used on this order. Refresh the order details.";
    case 'BALANCE_WINDOW_CLOSED':
      return 'The time to pay the balance has passed. Refresh the order.';
    case 'NOT_FOUND_REQUIRES_UTR':
      return 'Enter a UTR before marking payment as not found.';
    case 'ALREADY_ANSWERED':
      return 'You already responded to this payment check.';
    case 'UTR_PRESENT':
      return "You can't reject this order after the customer entered a UTR. Confirm or report a payment issue.";
    case 'CANCEL_NOT_ALLOWED':
      return "This order can't be cancelled at this stage.";
    case 'ALL_ITEMS_UNAVAILABLE':
      return 'All items are already marked unavailable.';
    case 'ALREADY_UNAVAILABLE':
      return 'Those items are already marked unavailable.';
    case 'REFUND_CAP':
      return 'Refund amount is invalid. Refresh and use the amount shown.';
    case 'STOCK_SHORT_UNRESOLVED':
      return 'Resolve stock short (mark unavailable items or cancel) before continuing.';
    case 'ALREADY_SUBMITTED':
      return 'This was already submitted. Refresh the order.';
    case 'AMOUNT_MISMATCH':
      return "The refund amount doesn't match what's due. Use the exact amount shown.";
    case 'VALIDATION':
      return 'Check the details you entered and try again.';
    case 'REFUND_UTR_REQUIRED':
      return 'Enter the refund UTR and amount to mark this refund sent.';
    case 'RATE_LIMIT_EXCEEDED':
    case 'RATE_LIMITED':
      return 'Too many attempts. Wait a minute and try again.';
    case 'NETWORK_ERROR':
      return fallback || 'Check your connection and try again.';
    case 'INVALID_RESPONSE':
      return GENERIC_ORDER_ERROR;
    default:
      return GENERIC_ORDER_ERROR;
  }
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

/** @deprecated Use cancelledDetailCopy from shop-order-types */
export function cancelledCopy(order: ShopOrder): string {
  return cancelledDetailCopy(order);
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

function parseOrdersList(body: JsonRecord | null): ShopOrder[] {
  const data = nestedData(body) ?? body;
  const raw = Array.isArray(data?.orders) ? data.orders : Array.isArray(body?.orders) ? body.orders : [];
  return raw.map(parseOrder).filter((order): order is ShopOrder => order !== null);
}

async function fetchOrdersByStatus(status: string): Promise<ShopOrder[]> {
  const body = await requestJson(
    `/api/shop/orders?status=${encodeURIComponent(status)}`,
    { method: 'GET' },
    'Could not load orders.',
  );
  return parseOrdersList(body);
}

export async function fetchShopOrders(filter: OrdersListFilter = 'all'): Promise<ShopOrder[]> {
  if (filter === 'all') {
    const body = await requestJson('/api/shop/orders', { method: 'GET' }, 'Could not load orders.');
    return parseOrdersList(body);
  }

  if (filter === 'awaiting_payment') {
    const batches = await Promise.all([
      fetchOrdersByStatus('awaiting_payment'),
      fetchOrdersByStatus('payment_unconfirmed'),
      fetchOrdersByStatus('payment_review'),
    ]);
    return mergeAwaitingPaymentOrders(batches);
  }

  const status =
    filter === 'completed' ? 'completed' : filter === 'preparing' ? 'preparing' : 'ready';
  return fetchOrdersByStatus(status);
}

function parseTransition(body: JsonRecord | null, fallback: string): OrderTransitionResult {
  const data = nestedData(body) ?? body;
  const order = parseOrder(data?.order);
  if (!order) {
    throw new OrdersApiError(fallback, 500, 'INVALID_RESPONSE');
  }
  const message = typeof body?.message === 'string' ? body.message : '';
  const refundRequired =
    data && typeof data.refundRequired === 'boolean' ? data.refundRequired : null;
  return {
    order,
    alreadyProcessed: message === 'Already processed',
    refundRequired,
  };
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

export async function confirmOrderPayment(
  id: string,
  payload: ConfirmPaymentPayload,
): Promise<OrderTransitionResult> {
  return postTransition(id, 'confirm-payment', payload as JsonRecord);
}

export async function reportAmountDiffers(
  id: string,
  payload: AmountDiffersPayload,
): Promise<OrderTransitionResult> {
  return postTransition(id, 'amount-differs', payload as JsonRecord);
}

export async function reportPaymentNotFound(
  id: string,
  payload: PaymentNotFoundPayload = {},
): Promise<OrderTransitionResult> {
  return postTransition(id, 'payment-not-found', payload as JsonRecord);
}

export async function submitPaidCheck(
  id: string,
  payload: PaidCheckPayload,
): Promise<OrderTransitionResult> {
  return postTransition(id, 'paid-check', payload as JsonRecord);
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

