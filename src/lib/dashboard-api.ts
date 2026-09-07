import { apiUrl } from '@/lib/api';
import { getSessionToken } from '@/lib/session';

type JsonRecord = Record<string, unknown>;

export class DashboardApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = 'DashboardApiError';
    this.status = status;
    this.code = code;
  }
}

export type ShopCoordinate = {
  latitude: number;
  longitude: number;
};

export type ShopProfile = {
  shopName: string;
  shopType: string | null;
  isOpen: boolean;
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  location: ShopCoordinate | null;
  accountHolderName: string | null;
  bankName: string | null;
  accountNumberLast4: string | null;
  ifsc: string | null;
  upiId: string | null;
  upiVerified: boolean;
};

export type ShopAccountProfileUpdateInput = {
  name: string;
  email: string;
};

export type ShopAccountPasswordUpdateInput = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export type ShopBankDetailsUpdateInput = {
  currentPassword: string;
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  upiId: string;
};

export type ShopProfileUpdateInput = {
  currentPassword: string;
  shopName: string;
  shopType: string;
  address: string;
  location: { lat: number; lng: number };
};

export type DashboardStats = {
  todayEarnings: number;
  totalOrders: number;
  awaitingPayment: number;
  preparing: number;
  ready: number;
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

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function nameIsPhoneNumber(name: string | null, phone: string | null): boolean {
  if (!name || !phone) return false;
  if (name.trim() === phone.trim()) return true;
  const nameDigits = digitsOnly(name);
  const phoneDigits = digitsOnly(phone);
  return nameDigits.length >= 10 && nameDigits === phoneDigits;
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
    if (typeof value === 'number') {
      if (value === 1) return true;
      if (value === 0) return false;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'open'].includes(normalized)) return true;
      if (['false', '0', 'no', 'closed'].includes(normalized)) return false;
    }
  }
  return null;
}

function isValidCoordinate(latitude: number, longitude: number): boolean {
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

function parseCoordinate(value: unknown): ShopCoordinate | null {
  const record = asRecord(value);
  if (!record) return null;

  const latitude = readNumber(record, ['lat', 'latitude', '_latitude']);
  const longitude = readNumber(record, ['lng', 'longitude', '_longitude']);
  if (latitude === null || longitude === null || !isValidCoordinate(latitude, longitude)) {
    return null;
  }

  return { latitude, longitude };
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

function profileRecords(body: JsonRecord | null): JsonRecord[] {
  const data = nestedData(body) ?? body;
  const shop = asRecord(data?.shop) ?? asRecord(body?.shop);
  return [data, body, shop].filter((record): record is JsonRecord => record !== null);
}

function parseShopProfile(body: JsonRecord | null): ShopProfile {
  const records = profileRecords(body);
  const data = nestedData(body) ?? body;
  const shop = asRecord(data?.shop) ?? asRecord(body?.shop);
  const userRecords = [asRecord(data?.user), asRecord(body?.user)].filter(
    (record): record is JsonRecord => record !== null,
  );
  const bankRecords = records
    .map((record) => asRecord(record.bank))
    .filter((record): record is JsonRecord => record !== null);

  let shopName: string | null = null;
  let shopType: string | null = null;
  let isOpen: boolean | null = null;
  let name: string | null = null;
  let email: string | null = null;
  let phone: string | null = null;
  let address: string | null = null;
  let location: ShopCoordinate | null = null;
  let accountHolderName: string | null = null;
  let bankName: string | null = null;
  let accountNumberLast4: string | null = null;
  let ifsc: string | null = null;
  let upiId: string | null = null;
  let upiVerified: boolean | null = null;

  for (const record of records) {
    shopName = shopName ?? readString(record, ['shopName']);
    shopType = shopType ?? readString(record, ['shopType']);
    isOpen = isOpen ?? readBoolean(record, ['isOpen']);
    if (record !== shop) {
      name = name ?? readString(record, ['name']);
      email = email ?? readString(record, ['email']);
    }
    phone = phone ?? readString(record, ['phone', 'phoneNumber']);
    address = address ?? readString(record, ['address', 'formattedAddress']);
    location =
      location ??
      parseCoordinate(record.location) ??
      parseCoordinate(record.coordinates) ??
      parseCoordinate(record);
    accountHolderName =
      accountHolderName ?? readString(record, ['accountHolderName', 'accountHolder']);
    bankName = bankName ?? readString(record, ['bankName']);
    accountNumberLast4 =
      accountNumberLast4 ??
      readString(record, ['accountNumberLast4', 'accountLast4', 'last4']);
    ifsc = ifsc ?? readString(record, ['ifsc', 'ifscCode']);
    upiId = upiId ?? readString(record, ['upiId', 'upi']);
    upiVerified = upiVerified ?? readBoolean(record, ['upiVerified', 'isUpiVerified']);
  }

  for (const record of userRecords) {
    name = name ?? readString(record, ['name']);
    email = email ?? readString(record, ['email']);
    phone = phone ?? readString(record, ['phone', 'phoneNumber']);
  }

  for (const record of bankRecords) {
    accountHolderName =
      accountHolderName ?? readString(record, ['accountHolderName', 'accountHolder', 'holderName']);
    bankName = bankName ?? readString(record, ['bankName', 'name']);
    accountNumberLast4 =
      accountNumberLast4 ??
      readString(record, ['accountNumberLast4', 'accountLast4', 'last4']);
    ifsc = ifsc ?? readString(record, ['ifsc', 'ifscCode']);
    upiId = upiId ?? readString(record, ['upiId', 'upi']);
    upiVerified = upiVerified ?? readBoolean(record, ['upiVerified', 'isUpiVerified']);
  }

  return {
    shopName: shopName ?? '',
    shopType,
    isOpen: isOpen ?? false,
    name: nameIsPhoneNumber(name, phone) ? null : name,
    email,
    phone,
    address,
    location,
    accountHolderName,
    bankName,
    accountNumberLast4,
    ifsc,
    upiId,
    upiVerified: upiVerified ?? false,
  };
}

function parseDashboardStats(body: JsonRecord | null): DashboardStats {
  const data = nestedData(body) ?? body;
  const stats = asRecord(data?.stats) ?? data;
  return {
    todayEarnings: readNumber(stats, ['todayEarnings', 'todaysEarnings', 'earningsToday']) ?? 0,
    totalOrders: readNumber(stats, ['totalOrders', 'orderCount']) ?? 0,
    awaitingPayment:
      readNumber(stats, ['awaitingPayment', 'awaiting_payment', 'awaitingPaymentCount']) ?? 0,
    preparing: readNumber(stats, ['preparing', 'preparingCount']) ?? 0,
    ready: readNumber(stats, ['ready', 'readyForPickup', 'ready_for_pickup', 'readyCount']) ?? 0,
  };
}

export async function fetchShopProfile(): Promise<ShopProfile> {
  const body = await requestJson(
    '/api/shop/profile',
    { method: 'GET' },
    'Could not load your shop profile.',
  );
  return parseShopProfile(body);
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const body = await requestJson(
    '/api/shop/dashboard/stats',
    { method: 'GET' },
    'Could not load dashboard stats.',
  );
  return parseDashboardStats(body);
}

export async function updateShopProfile(input: ShopProfileUpdateInput): Promise<void> {
  await requestJson(
    '/api/shop/profile',
    {
      method: 'PUT',
      body: JSON.stringify({
        currentPassword: input.currentPassword,
        shopName: input.shopName,
        shopType: input.shopType,
        address: input.address,
        location: input.location,
      }),
    },
    'Could not update your business profile.',
  );
}

export async function updateShopAccountProfile(input: ShopAccountProfileUpdateInput): Promise<void> {
  await requestJson(
    '/api/shop/account/profile',
    {
      method: 'PUT',
      body: JSON.stringify({
        name: input.name,
        email: input.email,
      }),
    },
    'Could not update your account.',
  );
}

export async function updateShopAccountPassword(input: ShopAccountPasswordUpdateInput): Promise<void> {
  await requestJson(
    '/api/shop/account/password',
    {
      method: 'PUT',
      body: JSON.stringify({
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
        confirmPassword: input.confirmPassword,
      }),
    },
    'Could not update your password.',
  );
}

export async function verifyShopSettingsUpi(upiId: string): Promise<void> {
  await requestJson(
    '/api/shop/verify-upi',
    {
      method: 'POST',
      body: JSON.stringify({ upiId }),
    },
    'Could not verify this UPI ID.',
  );
}

export async function updateShopBankDetails(input: ShopBankDetailsUpdateInput): Promise<void> {
  await requestJson(
    '/api/shop/bank-details',
    {
      method: 'PUT',
      body: JSON.stringify({
        currentPassword: input.currentPassword,
        accountHolderName: input.accountHolderName,
        bankName: input.bankName,
        accountNumber: input.accountNumber,
        ifsc: input.ifsc,
        upiId: input.upiId,
      }),
    },
    'Could not update your bank details.',
  );
}

export async function updateShopStatus(isOpen: boolean): Promise<boolean> {
  const body = await requestJson(
    '/api/shop/status',
    {
      method: 'PUT',
      body: JSON.stringify({ isOpen }),
    },
    'Could not update store status.',
  );
  const records = profileRecords(body);
  for (const record of records) {
    const next = readBoolean(record, ['isOpen']);
    if (next !== null) return next;
  }
  return isOpen;
}

export type PaymentHistoryItem = {
  orderId: string;
  displayId: number | null;
  amount: number;
  paymentStatus: 'confirmed' | 'refunded';
  at: Date | null;
};

function parseHistoryTimestamp(value: unknown): Date | null {
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

function parsePaymentHistoryItem(value: unknown): PaymentHistoryItem | null {
  const record = asRecord(value);
  if (!record) return null;
  const orderId = readString(record, ['orderId', 'id']);
  const paymentStatus = readString(record, ['paymentStatus', 'status']);
  if (!orderId || (paymentStatus !== 'confirmed' && paymentStatus !== 'refunded')) {
    return null;
  }
  return {
    orderId,
    displayId: readNumber(record, ['displayId']),
    amount: readNumber(record, ['amount']) ?? 0,
    paymentStatus,
    at: parseHistoryTimestamp(record.at ?? record.confirmedAt ?? record.refundedAt),
  };
}

export async function fetchPaymentHistory(): Promise<PaymentHistoryItem[]> {
  const body = await requestJson(
    '/api/shop/payment-history',
    { method: 'GET' },
    'Could not load payment history.',
  );
  const data = nestedData(body) ?? body;
  const raw = Array.isArray(data?.history)
    ? data.history
    : Array.isArray(body?.history)
      ? body.history
      : [];
  return raw
    .map(parsePaymentHistoryItem)
    .filter((item): item is PaymentHistoryItem => item !== null);
}

export async function deactivateShop(): Promise<void> {
  await requestJson(
    '/api/shop/deactivate',
    { method: 'POST' },
    'Could not deactivate your shop.',
  );
}

