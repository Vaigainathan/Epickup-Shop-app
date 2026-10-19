import { mapApiErrorCode } from '@/lib/api-error-messages';
import { ShopDocumentsApiError } from '@/lib/shop-documents-api';

const DOCUMENTS_CODES: Record<string, string> = {
  VALIDATION: 'Check the file you selected and try again.',
  FILE_TOO_LARGE: 'This file is too large. Choose a smaller image.',
  INVALID_FILE_TYPE: 'Use a JPEG or PNG image.',
};

export function documentsErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ShopDocumentsApiError)) return fallback;
  return mapApiErrorCode(error, DOCUMENTS_CODES, fallback);
}
