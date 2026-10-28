import { apiUrl } from '@/lib/api';
import { DashboardApiError } from '@/lib/dashboard-api';
import { getSessionToken } from '@/lib/session';

type JsonRecord = Record<string, unknown>;

export const EARNINGS_PERIOD_KEYS = [
  'today',
  'yesterday',
  'thisMonth',
  'lastMonth',
  'allTime',
] as const;

export type EarningsPeriodKey = (typeof EARNINGS_PERIOD_KEYS)[number];

export type EarningsPeriodStats = {
  received: number;
  refunded: number;
  net: number;
  paidOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  refundsSent: number;
};

export type ShopEarnings = {
  currency: string;
  timezone: string;
  asOf: Date | null;
  periods: Record<EarningsPeriodKey, EarningsPeriodStats>;
  refundsDue: { count: number; amount: number };
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

function errorMessage(body: JsonRecord | null, fallback: string): string {
  if (!body) return fallback;
  if (typeof body.error === 'string' && body.error.length > 0) return body.error;
  const error = asRecord(body.error);
  if (error && typeof error.message === 'string' && error.message.length > 0) {
    return error.message;
  }
  if (typeof body.message === 'string' && body.message.length > 0) return body.message;
  return fallback;
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
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function parseAsOfTimestamp(value: unknown): Date | null {
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
  if (seconds === null) return null;
  const nanos = readNumber(record, ['_nanoseconds', 'nanoseconds']) ?? 0;
  const date = new Date(seconds * 1000 + Math.floor(nanos / 1e6));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function zeroEarningsPeriodStats(): EarningsPeriodStats {
  return {
    received: 0,
    refunded: 0,
    net: 0,
    paidOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    refundsSent: 0,
  };
}

function parseEarningsPeriodStats(value: unknown): EarningsPeriodStats {
  const record = asRecord(value);
  if (!record) return zeroEarningsPeriodStats();
  return {
    received: readNumber(record, ['received']) ?? 0,
    refunded: readNumber(record, ['refunded']) ?? 0,
    net: readNumber(record, ['net']) ?? 0,
    paidOrders: readNumber(record, ['paidOrders']) ?? 0,
    completedOrders: readNumber(record, ['completedOrders']) ?? 0,
    cancelledOrders: readNumber(record, ['cancelledOrders']) ?? 0,
    refundsSent: readNumber(record, ['refundsSent']) ?? 0,
  };
}

export function parseShopEarningsResponse(body: unknown): ShopEarnings {
  const root = asRecord(body);
  const data = nestedData(root) ?? root;
  const record = asRecord(data) ?? {};

  const periodsRecord = asRecord(record.periods);
  const periods = {} as Record<EarningsPeriodKey, EarningsPeriodStats>;
  for (const key of EARNINGS_PERIOD_KEYS) {
    periods[key] = parseEarningsPeriodStats(periodsRecord?.[key]);
  }

  const refundsDueRecord = asRecord(record.refundsDue);

  return {
    currency: readString(record, ['currency']) ?? 'INR',
    timezone: readString(record, ['timezone']) ?? 'Asia/Kolkata',
    asOf: parseAsOfTimestamp(record.asOf),
    periods,
    refundsDue: {
      count: readNumber(refundsDueRecord, ['count']) ?? 0,
      amount: readNumber(refundsDueRecord, ['amount']) ?? 0,
    },
  };
}

async function authorizedRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getSessionToken();
  if (!token) {
    throw new DashboardApiError('Your session expired. Please log in again.', 401, 'UNAUTHENTICATED');
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
    if (error instanceof DashboardApiError) throw error;
    throw new DashboardApiError(fallback, 0, 'NETWORK_ERROR');
  }

  const body = await parseJson(response);
  if (!response.ok) {
    throw new DashboardApiError(errorMessage(body, fallback), response.status, errorCode(body));
  }

  return body;
}

export async function fetchShopEarnings(): Promise<ShopEarnings> {
  const body = await requestJson(
    '/api/shop/earnings',
    { method: 'GET' },
    'Could not load earnings.',
  );
  return parseShopEarningsResponse(body);
}
