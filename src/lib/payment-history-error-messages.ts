import { dashboardErrorMessage } from '@/lib/dashboard-error-messages';

export function paymentHistoryErrorMessage(error: unknown, fallback: string): string {
  return dashboardErrorMessage(error, fallback);
}
