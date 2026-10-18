import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { type ReactNode, useEffect, useRef } from 'react';

import { requestOrdersRefresh } from '@/lib/orders-refresh';
import { registerShopPushFromDevice } from '@/lib/shop-push-registration';
import { getPushRoute, parsePushData } from '@/lib/shop-push';
import { getSessionToken } from '@/lib/session';

const handledNotificationIds = new Set<string>();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function notificationId(response: Notifications.NotificationResponse): string {
  const request = response.notification.request;
  return request.identifier ?? `${request.content.title ?? ''}-${request.content.body ?? ''}`;
}

async function navigateFromPush(data: Record<string, unknown> | undefined): Promise<void> {
  const session = await getSessionToken();
  if (!session) return;

  const parsed = parsePushData(data ?? null);
  const route = getPushRoute(parsed);
  if (route.kind === 'ignore') return;
  if (route.kind === 'orders_list') {
    router.push('/(app)/(orders)');
    return;
  }
  router.push(`/(app)/(orders)/${encodeURIComponent(route.orderId)}`);
}

async function handleNotificationResponse(
  response: Notifications.NotificationResponse,
  skipIfHandled: boolean,
): Promise<void> {
  const id = notificationId(response);
  if (skipIfHandled && handledNotificationIds.has(id)) return;
  handledNotificationIds.add(id);
  const data = response.notification.request.content.data as Record<string, unknown> | undefined;
  await navigateFromPush(data);
}

export function ShopPushProvider({ children }: { children: ReactNode }) {
  const coldStartDone = useRef(false);

  useEffect(() => {
    registerShopPushFromDevice();

    const tokenSub = Notifications.addPushTokenListener(() => {
      registerShopPushFromDevice();
    });

    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      requestOrdersRefresh();
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationResponse(response, false);
    });

    if (!coldStartDone.current) {
      coldStartDone.current = true;
      Notifications.getLastNotificationResponseAsync().then((response) => {
        if (response) {
          handleNotificationResponse(response, true);
        }
      });
    }

    return () => {
      tokenSub.remove();
      receivedSub.remove();
      responseSub.remove();
    };
  }, []);

  return children;
}
