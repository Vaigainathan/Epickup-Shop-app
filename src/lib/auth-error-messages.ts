import { mapApiErrorCode } from '@/lib/api-error-messages';
import { AuthApiError } from '@/lib/auth-api';

export const USER_INACTIVE_LOGIN_COPY =
  'Your account is deactivated. Contact support to reactivate.';

const AUTH_CODES: Record<string, string> = {
  INVALID_TOKEN: 'Invalid verification code',
  WEAK_PASSWORD: 'Choose a stronger password that meets all requirements.',
  MISSING_PASSWORD: 'Enter a password that meets all requirements.',
  USER_INACTIVE: USER_INACTIVE_LOGIN_COPY,
  USER_NOT_FOUND: 'We could not find your account. Try signing up again.',
  FORBIDDEN: 'This action is not allowed for your account.',
  SERVICE_UNAVAILABLE: 'Service is temporarily unavailable. Try again in a moment.',
  PHONE_CHECK_ERROR: 'Could not verify this phone number. Try again.',
  INVALID_BUSINESS_DETAILS: 'Check your shop name, type, address, and map pin.',
  INVALID_SHOP_TYPE: 'Choose a valid business type.',
  INVALID_LOCATION: 'Pick a valid location on the map.',
  MISSING_FILE: 'Choose a file to upload.',
  FILE_TOO_LARGE: 'This file is too large. Choose a smaller image.',
  INVALID_FILE_TYPE: 'Use a JPEG, PNG, or PDF.',
  UPI_NOT_VERIFIED: 'Verify your UPI ID before continuing.',
  INVALID_BANK_DETAILS: 'Check your bank account details and try again.',
  VALIDATION: 'Check the details you entered and try again.',
};

export function authErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof AuthApiError)) return fallback;
  if (error.code === 'NETWORK_ERROR') {
    return fallback;
  }
  return mapApiErrorCode(error, AUTH_CODES, fallback);
}

export function authSignUpPhoneErrorMessage(error: unknown, resetGeneric: string): string {
  if (!(error instanceof AuthApiError)) return resetGeneric;
  if (error.code === 'NETWORK_ERROR') return '';
  return authErrorMessage(error, resetGeneric);
}

export function isAuthNetworkFailure(error: unknown): boolean {
  if (error instanceof AuthApiError && error.code === 'NETWORK_ERROR') return true;
  const message = error instanceof Error ? error.message : '';
  return (
    message.toLowerCase().includes('network') ||
    message.toLowerCase().includes('fetch') ||
    message.length === 0
  );
}
