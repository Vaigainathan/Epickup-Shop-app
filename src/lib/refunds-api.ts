import { apiUrl } from '@/lib/api';
import { OrdersApiError } from '@/lib/orders-api';
import { parseTimestamp } from '@/lib/shop-order-types';
import { getSessionToken } from '@/lib/session';

type JsonRecord = Record<string, unknown>;

export type ShopRefundListItem = {
  id: string;
  orderId: string;
  displayId: number | null;
  customerName: string | null;
  reason: string | null;
  status: string | null;
  amount: number | null;
  dueBy: Date | null;
  customerUpiId: string | null;
  refundUtr: string | null;
  sentAmount: number | null;
};

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

function readString(record: JsonRecord | null, keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return null;
}

function readNumber(record: JsonRecord | null, keys: string[]): number | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

function errorCode(body: JsonRecord | null): string | null {
  if (!body) return null;
  if (typeof body.code === 'string' && body.code.length > 0) return body.code;
  const error = asRecord(body.error);
  if (error && typeof error.code === 'string') return error.code;
  return null;
}

function backendMessage(body: JsonRecord | null, fallback: string): string {
  if (!body) return fallback;
  if (typeof body.error === 'string' && body.error.length > 0) return body.error;
  const error = asRecord(body.error);
  if (error && typeof error.message === 'string') return error.message;
  if (typeof body.message === 'string') return body.message;
  return fallback;
}

async function requestJson(path: string, init: RequestInit, fallback: string): Promise<JsonRecord | null> {
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

  let response: Response;
  try {
    response = await fetch(apiUrl(path), { ...init, headers });
  } catch {
    throw new OrdersApiError(fallback, 0, 'NETWORK_ERROR');
  }

  const body = await parseJson(response);
  if (!response.ok) {
    throw new OrdersApiError(backendMessage(body, fallback), response.status, errorCode(body));
  }
  return body;
}

function parseRefundItem(value: unknown): ShopRefundListItem | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = readString(record, ['id', 'refundId']);
  const orderId = readString(record, ['orderId']);
  if (!id || !orderId) return null;
  return {
    id,
    orderId,
    displayId: readNumber(record, ['displayId']),
    customerName: readString(record, ['customerName']),
    reason: readString(record, ['reason']),
    status: readString(record, ['status']),
    amount: readNumber(record, ['amount']),
    dueBy: parseTimestamp(record.dueBy),
    customerUpiId: readString(record, ['customerUpiId']),
    refundUtr: readString(record, ['refundUtr']),
    sentAmount: readNumber(record, ['sentAmount']),
  };
}

export async function fetchShopRefunds(
  status?: 'due' | 'overdue' | 'sent',
): Promise<ShopRefundListItem[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const body = await requestJson(`/api/shop/refunds${query}`, { method: 'GET' }, 'Could not load refunds.');
  const data = nestedData(body) ?? body;
  const raw = Array.isArray(data?.refunds) ? data.refunds : [];
  return raw.map(parseRefundItem).filter((r): r is ShopRefundListItem => r !== null);
}

export async function fetchRefundsDueCount(): Promise<number> {
  const [due, overdue] = await Promise.all([
    fetchShopRefunds('due'),
    fetchShopRefunds('overdue'),
  ]);
  return due.length + overdue.length;
}

export async function submitRefundSent(
  orderId: string,
  refundId: string,
  payload: { refundUtr: string; amount: number },
): Promise<void> {
  await requestJson(
    `/api/shop/orders/${encodeURIComponent(orderId)}/refunds/${encodeURIComponent(refundId)}/sent`,
    { method: 'POST', body: JSON.stringify(payload) },
    'Could not mark refund as sent.',
  );
}
