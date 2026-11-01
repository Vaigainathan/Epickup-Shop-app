import { triggerLiveRefresh } from '@/lib/live-refresh';

export function requestOrdersRefresh(): void {
  void triggerLiveRefresh('orders');
}

export function requestDashboardRefresh(): void {
  void triggerLiveRefresh('dashboard');
}

export function requestAllLiveDataRefresh(): void {
  void triggerLiveRefresh('orders');
  void triggerLiveRefresh('dashboard');
}
