import { GENERIC_API_ERROR, mapApiErrorCode } from '@/lib/api-error-messages';
import { CatalogueApiError } from '@/lib/catalogue-api';

const CATALOGUE_CODES: Record<string, string> = {
  CATEGORY_IN_USE:
    'This category still has products. Reassign or delete those products first.',
  CATEGORY_NOT_FOUND: 'Category not found.',
  PRODUCT_NOT_FOUND: 'Product not found.',
  VALIDATION: 'Check the details you entered and try again.',
  INVALID_RESPONSE: GENERIC_API_ERROR,
};

export function catalogueErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof CatalogueApiError)) return fallback;
  return mapApiErrorCode(error, CATALOGUE_CODES, fallback);
}
