import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

import { getPushRoute, parsePushData } from '@/lib/shop-push';
import {
  isHandledPushNotificationId,
  markHandledPushNotificationId,
  resetHandledPushStoreForTests,
} from '@/lib/handled-push-store';
import { getSessionToken } from '@/lib/session';

const handledNotificationIds = new Set<string>();
const inFlightNotificationIds = new Set<string>();

export type NavigateFromPushOutcome = 'no_session' | 'clear_only' | 'navigated';

export function notificationId(response: Notifications.NotificationResponse): string {
  const request = response.notification.request;
  return request.identifier ?? `${request.content.title ?? ''}-${request.content.body ?? ''}`;
}

export async function navigateFromPush(
  data: Record<string, unknown> | undefined,
): Promise<NavigateFromPushOutcome> {
  const session = await getSessionToken();
  if (!session) return 'no_session';

  const parsed = parsePushData(data ?? null);
  const route = getPushRoute(parsed);
  if (route.kind === 'ignore') return 'clear_only';
  if (route.kind === 'orders_list') {
    router.push('/(app)/(orders)');
    return 'navigated';
  }
  if (route.kind === 'refunds_list') {
    const orderId = route.orderId;
    if (orderId) {
      router.push(`/(app)/(refunds)?orderId=${encodeURIComponent(orderId)}`);
    } else {
      router.push('/(app)/(refunds)');
    }
    return 'navigated';
  }
  router.push(`/(app)/(orders)/${encodeURIComponent(route.orderId)}`);
  return 'navigated';
}

export async function clearLastNotificationResponseSafe(): Promise<void> {
  try {
    await Notifications.clearLastNotificationResponseAsync();
  } catch (error) {
    if (__DEV__) {
      console.warn('clearLastNotificationResponseAsync failed', error);
    }
  }
}

export async function handleNotificationResponse(
  response: Notifications.NotificationResponse,
): Promise<void> {
  const id = notificationId(response);
  const skippedInMemory =
    handledNotificationIds.has(id) || inFlightNotificationIds.has(id);
  if (skippedInMemory) return;

  inFlightNotificationIds.add(id);
  try {
    if (await isHandledPushNotificationId(id)) {
      return;
    }

    const data = response.notification.request.content.data as Record<string, unknown> | undefined;
    const outcome = await navigateFromPush(data);

    if (outcome !== 'no_session') {
      handledNotificationIds.add(id);
      try {
        await markHandledPushNotificationId(id);
      } catch (error) {
        if (__DEV__) {
          console.warn('markHandledPushNotificationId failed', error);
        }
      }
      await clearLastNotificationResponseSafe();
    }
  } finally {
    inFlightNotificationIds.delete(id);
  }
}

/** @internal test helper */
export function resetShopPushNotificationHandlerForTests(): void {
  handledNotificationIds.clear();
  inFlightNotificationIds.clear();
  resetHandledPushStoreForTests();
}
