import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { devPushLog } from '@/lib/shop-push-register-retry';

const VIBRATION = [0, 250, 250, 250] as const;

let channelsSetupAttempted = false;

export async function ensureShopNotificationChannels(): Promise<void> {
  if (channelsSetupAttempted) return;
  channelsSetupAttempted = true;

  if (Platform.OS !== 'android') return;

  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [...VIBRATION],
      lightColor: '#000666',
    });

    await Notifications.setNotificationChannelAsync('shop_orders', {
      name: 'Shop orders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [...VIBRATION],
      lightColor: '#000666',
    });

    await Notifications.setNotificationChannelAsync('shop_payments', {
      name: 'Shop payments',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [...VIBRATION],
      lightColor: '#000666',
    });

    await Notifications.setNotificationChannelAsync('shop_updates', {
      name: 'Shop updates',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [...VIBRATION],
      lightColor: '#000666',
    });
  } catch (error) {
    devPushLog('ensureShopNotificationChannels failed', error);
  }
}

/** @internal test helper */
export function resetShopNotificationChannelsForTests(): void {
  channelsSetupAttempted = false;
}
