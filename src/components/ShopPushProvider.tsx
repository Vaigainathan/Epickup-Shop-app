import * as Notifications from 'expo-notifications';
import { type ReactNode, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { handleNotificationResponse } from '@/lib/shop-push-notification-handler';
import { requestAllLiveDataRefresh } from '@/lib/orders-refresh';
import {
  onAppForegroundForPush,
  registerShopPushFromDevice,
} from '@/lib/shop-push-registration';
import { isShopPushType, parsePushData } from '@/lib/shop-push';
import { ensureShopNotificationChannels } from '@/lib/shop-notification-channels';

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
    void ensureShopNotificationChannels();
    void registerShopPushFromDevice();

    const tokenSub = Notifications.addPushTokenListener(() => {
      void registerShopPushFromDevice();
    });

    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as Record<string, unknown> | undefined;
      const parsed = parsePushData(data ?? null);
      if (isShopPushType(parsed.type)) {
        requestAllLiveDataRefresh();
      }
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      void handleNotificationResponse(response);
    });

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        onAppForegroundForPush();
      }
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
      appStateSub.remove();
    };
  }, []);

  return children;
}
