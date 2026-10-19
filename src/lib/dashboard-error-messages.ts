import { GENERIC_API_ERROR, mapApiErrorCode } from '@/lib/api-error-messages';
import { DashboardApiError } from '@/lib/dashboard-api';

const DASHBOARD_CODES: Record<string, string> = {
  INVALID_CREDENTIALS: 'That password is incorrect. Your changes were not saved.',
  MISSING_PASSWORD: 'Enter your current password to save these changes.',
  INVALID_BANK_DETAILS:
    'These bank details were not accepted. Check the account number, IFSC, and UPI ID.',
  UPI_NOT_VERIFIED: 'This UPI ID is not verified. Verify it again before saving.',
  ORDERS_IN_PROGRESS:
    'Cannot deactivate while orders are in progress. Finish current orders, then try again.',
  VALIDATION: 'Check the details you entered and try again.',
  AUTH_RATE_LIMIT_EXCEEDED: 'Too many attempts. Try again in a few minutes.',
  WEAK_PASSWORD: 'Choose a stronger password that meets all requirements.',
  PASSWORD_MISMATCH: 'New password and confirmation do not match.',
  NO_PASSWORD: "Password login isn't set up on this account — contact support.",
};

export function dashboardErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof DashboardApiError)) return fallback;
  return mapApiErrorCode(error, DASHBOARD_CODES, fallback);
}

export function dashboardErrorMessageOrGeneric(error: unknown, fallback: string): string {
  return dashboardErrorMessage(error, fallback);
}

export { GENERIC_API_ERROR };
