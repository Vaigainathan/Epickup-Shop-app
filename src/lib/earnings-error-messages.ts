import { dashboardErrorMessage } from '@/lib/dashboard-error-messages';

export function earningsErrorMessage(error: unknown, fallback: string): string {
  return dashboardErrorMessage(error, fallback);
}
