import { apiUrl } from '@/lib/api';
import { appendLocalFile } from '@/lib/pick-media';
import { getSessionToken } from '@/lib/session';

type JsonRecord = Record<string, unknown>;

export class CatalogueApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = 'CatalogueApiError';
    this.status = status;
    this.code = code;
  }
}

export type ShopCategory = {
  id: string;
  name: string;
};

export const PRODUCT_UNIT_TYPES = [
  'Piece',
  'Kg',
  'Gram',
  'Litre',
  'ml',
  'Pack',
  'Plate',
] as const;

export type ProductUnitType = (typeof PRODUCT_UNIT_TYPES)[number];

export type ShopProductVariant = {
  id?: string;
  attributeLabel: string;
  value: string;
  stock: number;
  priceOverride: number | null;
  unitType: string | null;
};

export type ShopProduct = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  unitType: string;
  isActive: boolean;
  stock: number;
  photoUrl: string | null;
  categoryId: string | null;
  hasVariants: boolean;
  variants: ShopProductVariant[];
};

export type ProductPhotoFile = {
  uri: string;
  mimeType: string;
  fileName: string;
};

export type ShopProductInput = {
  name: string;
  description: string;
  price: number;
  unitType: string;
  categoryId: string;
  isActive: boolean;
  stock: number;
  hasVariants: boolean;
  variants: ShopProductVariant[];
  photo?: ProductPhotoFile | null;
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
      if (['true', '1', 'yes'].includes(normalized)) return true;
      if (['false', '0', 'no'].includes(normalized)) return false;
    }
  }
  return null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

async function authorizedRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getSessionToken();
  if (!token) {
    throw new CatalogueApiError('Your session expired. Please log in again.', 401, 'UNAUTHENTICATED');
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
  } catch (error) {
    if (error instanceof CatalogueApiError) throw error;
    throw new CatalogueApiError(fallback, 0, 'NETWORK_ERROR');
  }

  const body = await parseJson(response);
  if (!response.ok) {
    throw new CatalogueApiError(errorMessage(body, fallback), response.status, errorCode(body));
  }

  return body;
}

function parseCategory(value: unknown): ShopCategory | null {
  const record = asRecord(value);
  const id = readString(record, ['id', 'categoryId']);
  const name = readString(record, ['name']);
  if (!id || !name) return null;
  return { id, name };
}

function parseVariant(value: unknown): ShopProductVariant | null {
  const record = asRecord(value);
  if (!record) return null;

  const attributeLabel = readString(record, ['attributeLabel']) ?? '';
  const variantValue = readString(record, ['value']) ?? '';
  if (!attributeLabel && !variantValue && record.stock === undefined && record.id === undefined) {
    return null;
  }

  return {
    id: readString(record, ['id']) ?? undefined,
    attributeLabel,
    value: variantValue,
    stock: readNumber(record, ['stock']) ?? 0,
    priceOverride: readNumber(record, ['priceOverride']),
    unitType: readString(record, ['unitType']),
  };
}

function parseVariants(value: unknown): ShopProductVariant[] {
  return asArray(value)
    .map(parseVariant)
    .filter((variant): variant is ShopProductVariant => variant !== null);
}

function parseProduct(value: unknown): ShopProduct | null {
  const record = asRecord(value);
  const id = readString(record, ['id', 'productId']);
  const name = readString(record, ['name']);
  const price = readNumber(record, ['price']);
  const unitType = readString(record, ['unitType']);

  if (!id || !name || price === null || !unitType) return null;

  return {
    id,
    name,
    description: readString(record, ['description']),
    price,
    unitType,
    isActive: readBoolean(record, ['isActive']) ?? true,
    stock: readNumber(record, ['stock']) ?? 0,
    photoUrl: readString(record, ['photoUrl']),
    categoryId: readString(record, ['categoryId']),
    hasVariants: readBoolean(record, ['hasVariants']) ?? false,
    variants: parseVariants(record?.variants),
  };
}

function parseProductPayload(body: JsonRecord | null): ShopProduct {
  const data = nestedData(body) ?? body ?? {};
  const product = parseProduct(data.product) ?? parseProduct(data);
  if (!product) {
    throw new CatalogueApiError('Product response was missing.', 500, 'INVALID_RESPONSE');
  }
  return product;
}

function serializeVariants(variants: ShopProductVariant[]) {
  return variants.map((variant) => {
    const payload: Record<string, unknown> = {
      attributeLabel: variant.attributeLabel,
      value: variant.value,
      stock: variant.stock,
      priceOverride: variant.priceOverride,
    };
    if (variant.id) payload.id = variant.id;
    if (variant.unitType) payload.unitType = variant.unitType;
    return payload;
  });
}

async function appendProductFields(form: FormData, input: ShopProductInput) {
  form.append('name', input.name);
  form.append('description', input.description);
  form.append('price', String(input.price));
  form.append('unitType', input.unitType);
  form.append('categoryId', input.categoryId);
  form.append('isActive', input.isActive ? 'true' : 'false');
  form.append('hasVariants', input.hasVariants ? 'true' : 'false');

  if (input.hasVariants) {
    form.append('stock', '0');
    form.append(
      'variants',
      JSON.stringify(
        serializeVariants(
          input.variants.map((variant) => ({
            ...variant,
            unitType: variant.unitType && variant.unitType.length > 0 ? variant.unitType : null,
          })),
        ),
      ),
    );
  } else {
    form.append('stock', String(input.stock));
    form.append('variants', JSON.stringify([]));
  }

  if (input.photo) {
    await appendLocalFile(form, 'photo', input.photo);
  }
}

function parseCategoryList(body: JsonRecord | null): ShopCategory[] {
  const data = nestedData(body) ?? body ?? {};
  const raw = asArray(data.categories);
  return raw
    .map(parseCategory)
    .filter((category): category is ShopCategory => category !== null);
}

function parseProductList(body: JsonRecord | null): ShopProduct[] {
  const data = nestedData(body) ?? body ?? {};
  const raw = asArray(data.products);
  return raw
    .map(parseProduct)
    .filter((product): product is ShopProduct => product !== null);
}

function parseCategoryPayload(body: JsonRecord | null): ShopCategory {
  const data = nestedData(body) ?? body ?? {};
  const category = parseCategory(data.category) ?? parseCategory(data);
  if (!category) {
    throw new CatalogueApiError('Category response was missing.', 500, 'INVALID_RESPONSE');
  }
  return category;
}

export async function fetchShopCategories(): Promise<ShopCategory[]> {
  const body = await requestJson('/api/shop/categories', { method: 'GET' }, 'Could not load categories.');
  return parseCategoryList(body);
}

export async function fetchShopProducts(): Promise<ShopProduct[]> {
  const body = await requestJson('/api/shop/products', { method: 'GET' }, 'Could not load products.');
  return parseProductList(body);
}

export async function createShopCategory(name: string): Promise<ShopCategory> {
  const body = await requestJson(
    '/api/shop/categories',
    {
      method: 'POST',
      body: JSON.stringify({ name }),
    },
    'Could not save this category.',
  );
  return parseCategoryPayload(body);
}

export async function updateShopCategory(id: string, name: string): Promise<ShopCategory> {
  const body = await requestJson(
    `/api/shop/categories/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      body: JSON.stringify({ name }),
    },
    'Could not update this category.',
  );
  return parseCategoryPayload(body);
}

export async function deleteShopCategory(id: string): Promise<void> {
  await requestJson(
    `/api/shop/categories/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    'Could not delete this category.',
  );
}

export async function fetchShopProduct(id: string): Promise<ShopProduct> {
  const body = await requestJson(
    `/api/shop/products/${encodeURIComponent(id)}`,
    { method: 'GET' },
    'Could not load this product.',
  );
  return parseProductPayload(body);
}

export async function createShopProduct(input: ShopProductInput): Promise<ShopProduct> {
  const form = new FormData();
  await appendProductFields(form, input);
  const body = await requestJson(
    '/api/shop/products',
    { method: 'POST', body: form },
    'Could not save this product.',
  );
  return parseProductPayload(body);
}

export async function updateShopProduct(id: string, input: ShopProductInput): Promise<ShopProduct> {
  const form = new FormData();
  await appendProductFields(form, input);
  const body = await requestJson(
    `/api/shop/products/${encodeURIComponent(id)}`,
    { method: 'PUT', body: form },
    'Could not update this product.',
  );
  return parseProductPayload(body);
}
