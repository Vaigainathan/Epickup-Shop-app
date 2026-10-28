import * as Notifications from 'expo-notifications';
import { type ReactNode, useEffect, useRef } from 'react';

import { handleNotificationResponse } from '@/lib/shop-push-notification-handler';
import { requestOrdersRefresh } from '@/lib/orders-refresh';
import { registerShopPushFromDevice } from '@/lib/shop-push-registration';
import { isShopPushType, parsePushData } from '@/lib/shop-push';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function ShopPushProvider({ children }: { children: ReactNode }) {
  const coldStartDone = useRef(false);

  useEffect(() => {
    registerShopPushFromDevice();

    const tokenSub = Notifications.addPushTokenListener(() => {
      registerShopPushFromDevice();
    });

    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as Record<string, unknown> | undefined;
      const parsed = parsePushData(data ?? null);
      if (isShopPushType(parsed.type)) {
        requestOrdersRefresh();
      }
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      void handleNotificationResponse(response);
    });

    if (!coldStartDone.current) {
      coldStartDone.current = true;
      Notifications.getLastNotificationResponseAsync().then((response) => {
        if (response) {
          void handleNotificationResponse(response);
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
