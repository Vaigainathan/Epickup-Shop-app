import { apiUrl } from '@/lib/api';
import { appendLocalFile } from '@/lib/pick-media';
import type { OpeningHoursWeek } from '@/lib/opening-hours';
import { getSessionToken } from '@/lib/session';

type JsonRecord = Record<string, unknown>;

export class StorefrontApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = 'StorefrontApiError';
    this.status = status;
    this.code = code;
  }
}

export type StorefrontData = {
  tagline: string;
  openingHours: OpeningHoursWeek | null;
  photoUrl: string | null;
  thumbUrl: string | null;
  thumbKey: string | null;
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
  const error = asRecord(body.error);
  if (error && typeof error.code === 'string' && error.code.length > 0) {
    return error.code;
  }
  return null;
}

const GENERIC = 'Something went wrong. Try again.';

export function storefrontErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof StorefrontApiError)) return fallback;
  if (error.status === 401 || error.code === 'UNAUTHENTICATED') {
    return 'Your session expired. Please log in again.';
  }
  switch (error.code) {
    case 'INVALID_OPENING_HOURS':
      return 'Check opening and closing times for each day.';
    case 'INVALID_TAGLINE':
      return 'Tagline must be 60 characters or fewer.';
    case 'VALIDATION':
      return 'Check the details you entered and try again.';
    case 'NETWORK_ERROR':
      return fallback || 'Check your connection and try again.';
    default:
      return GENERIC;
  }
}

function readString(record: JsonRecord | null, keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string') return value;
  }
  return null;
}

function parseOpeningHours(value: unknown): OpeningHoursWeek | null {
  const record = asRecord(value);
  if (!record) return null;
  const keys = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ] as const;
  const week = {} as OpeningHoursWeek;
  let any = false;
  for (const key of keys) {
    const day = asRecord(record[key]);
    if (!day) continue;
    any = true;
    if (day.closed === true) {
      week[key] = { closed: true };
      continue;
    }
    const open = readString(day, ['open']);
    const close = readString(day, ['close']);
    if (open && close) {
      week[key] = { open, close };
    }
  }
  return any ? week : null;
}

function parseStorefront(body: JsonRecord | null): StorefrontData {
  const data = nestedData(body) ?? body;
  const record = asRecord(data?.storefront) ?? data;
  const tagline = readString(record, ['tagline']) ?? '';
  return {
    tagline,
    openingHours: parseOpeningHours(record?.openingHours),
    photoUrl: readString(record, ['photoUrl']),
    thumbUrl: readString(record, ['thumbUrl']),
    thumbKey: readString(record, ['thumbKey']),
  };
}

async function authorizedRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getSessionToken();
  if (!token) {
    throw new StorefrontApiError('Your session expired. Please log in again.', 401, 'UNAUTHENTICATED');
  }
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set('Authorization', `Bearer ${token}`);
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (init.body && !headers.has('Content-Type') && !isFormData) {
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
  } catch {
    throw new StorefrontApiError(fallback, 0, 'NETWORK_ERROR');
  }
  const body = await parseJson(response);
  if (!response.ok) {
    throw new StorefrontApiError(fallback, response.status, errorCode(body));
  }
  return body;
}

export async function fetchStorefront(): Promise<StorefrontData> {
  const body = await requestJson('/api/shop/storefront', { method: 'GET' }, 'Could not load storefront.');
  return parseStorefront(body);
}

export async function updateStorefront(input: {
  tagline: string;
  openingHours: OpeningHoursWeek;
}): Promise<StorefrontData> {
  const body = await requestJson(
    '/api/shop/storefront',
    {
      method: 'PUT',
      body: JSON.stringify({
        tagline: input.tagline,
        openingHours: input.openingHours,
      }),
    },
    'Could not save storefront.',
  );
  return parseStorefront(body);
}

export async function uploadStorefrontPhoto(file: {
  uri: string;
  mimeType: string;
  fileName: string;
}): Promise<StorefrontData> {
  const form = new FormData();
  await appendLocalFile(form, 'photo', file);
  const body = await requestJson(
    '/api/shop/storefront/photo',
    { method: 'POST', body: form },
    'Could not upload photo.',
  );
  return parseStorefront(body);
}

export async function deleteStorefrontPhoto(): Promise<StorefrontData> {
  const body = await requestJson(
    '/api/shop/storefront/photo',
    { method: 'DELETE' },
    'Could not remove photo.',
  );
  return parseStorefront(body);
}
