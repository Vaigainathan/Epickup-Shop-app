import { apiUrl } from '@/lib/api';
import { appendLocalFile, LocalUploadFile } from '@/lib/pick-media';
import { getSessionToken } from '@/lib/session';

type JsonRecord = Record<string, unknown>;

export type ShopDocumentType = 'gst' | 'fssai';

export type ShopDocumentReviewStatus = 'verified' | 'action_required' | 'under_review' | null;

export type ShopDocumentStatuses = {
  gstStatus: ShopDocumentReviewStatus;
  fssaiStatus: ShopDocumentReviewStatus;
  fssaiExpiryDate: string | null;
};

export class ShopDocumentsApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = 'ShopDocumentsApiError';
    this.status = status;
    this.code = code;
  }
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' ? (value as JsonRecord) : null;
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

function errorCode(body: JsonRecord | null): string | null {
  if (!body) return null;
  if (typeof body.code === 'string' && body.code.length > 0) return body.code;
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

export function isFssaiExpiryDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function normalizeReviewStatus(raw: string | null): ShopDocumentReviewStatus {
  if (!raw) return null;
  const value = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (value === 'verified' || value === 'approved') return 'verified';
  if (value === 'action_required' || value === 'rejected') return 'action_required';
  if (
    value === 'under_review' ||
    value === 'pending' ||
    value === 'submitted' ||
    value === 'in_review'
  ) {
    return 'under_review';
  }
  return null;
}

function parseExpiryDate(raw: string | null): string | null {
  if (!raw) return null;
  const day = raw.trim().slice(0, 10);
  return isFssaiExpiryDate(day) ? day : null;
}

function statusRecords(body: JsonRecord | null): JsonRecord[] {
  const data = asRecord(body?.data) ?? body;
  const shop = asRecord(data?.shop) ?? asRecord(body?.shop);
  const documents =
    asRecord(data?.documents) ?? asRecord(body?.documents) ?? asRecord(shop?.documents);
  return [data, body, shop, documents].filter((record): record is JsonRecord => record !== null);
}

function parseDocumentStatuses(body: JsonRecord | null): ShopDocumentStatuses {
  const records = statusRecords(body);
  let gstStatus: ShopDocumentReviewStatus = null;
  let fssaiStatus: ShopDocumentReviewStatus = null;
  let fssaiExpiryDate: string | null = null;

  for (const record of records) {
    gstStatus = gstStatus ?? normalizeReviewStatus(readString(record, ['gstStatus', 'gst_status']));
    fssaiStatus =
      fssaiStatus ?? normalizeReviewStatus(readString(record, ['fssaiStatus', 'fssai_status']));
    fssaiExpiryDate =
      fssaiExpiryDate ??
      parseExpiryDate(readString(record, ['fssaiExpiryDate', 'fssai_expiry_date', 'fssaiExpiry']));
  }

  return { gstStatus, fssaiStatus, fssaiExpiryDate };
}

export async function fetchShopDocumentStatuses(): Promise<ShopDocumentStatuses> {
  const token = await getSessionToken();
  if (!token) {
    throw new ShopDocumentsApiError('Your session expired. Please log in again.', 401, 'UNAUTHENTICATED');
  }

  let response: Response;
  try {
    response = await fetch(apiUrl('/api/shop/onboarding/status'), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new ShopDocumentsApiError('Could not load your documents.', 0, 'NETWORK_ERROR');
  }

  let body: JsonRecord | null = null;
  try {
    const parsed = await response.json();
    body = asRecord(parsed);
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new ShopDocumentsApiError(
      errorMessage(body, 'Could not load your documents.'),
      response.status,
      errorCode(body),
    );
  }

  return parseDocumentStatuses(body);
}

export async function reuploadShopDocument(
  type: ShopDocumentType,
  file: LocalUploadFile,
  fssaiExpiryDate?: string | null,
): Promise<void> {
  const token = await getSessionToken();
  if (!token) {
    throw new ShopDocumentsApiError('Your session expired. Please log in again.', 401, 'UNAUTHENTICATED');
  }

  const form = new FormData();
  await appendLocalFile(form, type, file);
  if (type === 'fssai' && fssaiExpiryDate && isFssaiExpiryDate(fssaiExpiryDate)) {
    form.append('fssaiExpiryDate', fssaiExpiryDate);
  }

  let response: Response;
  try {
    response = await fetch(apiUrl(`/api/shop/documents/${type}`), {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: form,
    });
  } catch {
    throw new ShopDocumentsApiError('Could not upload this document.', 0, 'NETWORK_ERROR');
  }

  let body: JsonRecord | null = null;
  try {
    const parsed = await response.json();
    body = asRecord(parsed);
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new ShopDocumentsApiError(
      errorMessage(body, 'Could not upload this document.'),
      response.status,
      errorCode(body),
    );
  }
}
