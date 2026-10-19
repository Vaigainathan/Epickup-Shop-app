import { dashboardErrorMessage, GENERIC_API_ERROR } from '@/lib/dashboard-error-messages';
import { DashboardApiError } from '@/lib/dashboard-api';

const ORDERS_IN_PROGRESS_COPY =
  'Cannot deactivate while orders are in progress. Finish current orders, then try again.';

export function deactivateErrorMessage(error: unknown, fallback: string): string {
  if (
    error instanceof DashboardApiError &&
    (error.code === 'ORDERS_IN_PROGRESS' || error.status === 409)
  ) {
    return ORDERS_IN_PROGRESS_COPY;
  }
  return dashboardErrorMessage(error, fallback || GENERIC_API_ERROR);
}
