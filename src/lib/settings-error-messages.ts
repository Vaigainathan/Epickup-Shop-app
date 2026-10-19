import { dashboardErrorMessage } from '@/lib/dashboard-error-messages';

export function settingsErrorMessage(error: unknown, fallback: string): string {
  return dashboardErrorMessage(error, fallback);
}
