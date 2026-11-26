import * as Notifications from 'expo-notifications';
import { AndroidAudioContentType, AndroidAudioUsage } from 'expo-notifications';
import { Platform } from 'react-native';

import { devPushLog } from '@/lib/shop-push-register-retry';

const VIBRATION = [0, 250, 250, 250] as const;

/** Expo push + Android channel sound basename (bundled via app.json expo-notifications sounds). */
export const SHOP_ORDERS_V2_CHANNEL_ID = 'shop_orders_v2';
export const SHOP_NEW_ORDER_V2_SOUND = 'shop_new_order_v2.wav';

export const SHOP_REMINDERS_V2_CHANNEL_ID = 'shop_reminders_v2';
export const SHOP_REMINDER_V2_SOUND = 'shop_reminder_v2.wav';

const NOTIFICATION_AUDIO_ATTRIBUTES = {
  usage: AndroidAudioUsage.NOTIFICATION,
  contentType: AndroidAudioContentType.SONIFICATION,
  flags: {
    enforceAudibility: true,
    requestHardwareAudioVideoSynchronization: false,
  },
} as const;

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

    await Notifications.setNotificationChannelAsync(SHOP_ORDERS_V2_CHANNEL_ID, {
      name: 'Shop orders (alerts)',
      importance: Notifications.AndroidImportance.HIGH,
      sound: SHOP_NEW_ORDER_V2_SOUND,
      enableVibrate: true,
      vibrationPattern: [...VIBRATION],
      lightColor: '#000666',
      audioAttributes: NOTIFICATION_AUDIO_ATTRIBUTES,
    });

    await Notifications.setNotificationChannelAsync(SHOP_REMINDERS_V2_CHANNEL_ID, {
      name: 'Shop payment reminders',
      importance: Notifications.AndroidImportance.HIGH,
      sound: SHOP_REMINDER_V2_SOUND,
      enableVibrate: true,
      vibrationPattern: [...VIBRATION],
      lightColor: '#000666',
      audioAttributes: NOTIFICATION_AUDIO_ATTRIBUTES,
    });
  } catch (error) {
    devPushLog('ensureShopNotificationChannels failed', error);
  }
}

/** @internal test helper */
export function resetShopNotificationChannelsForTests(): void {
  channelsSetupAttempted = false;
}