import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const VIBRATION = [0, 250, 250, 250] as const;

export async function ensureShopNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [...VIBRATION],
    lightColor: '#000666',
    sound: 'default',
  });

  await Notifications.setNotificationChannelAsync('shop_orders', {
    name: 'Shop orders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [...VIBRATION],
    lightColor: '#000666',
    sound: 'default',
  });

  await Notifications.setNotificationChannelAsync('shop_payments', {
    name: 'Shop payments',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [...VIBRATION],
    lightColor: '#000666',
    sound: 'default',
  });

  await Notifications.setNotificationChannelAsync('shop_updates', {
    name: 'Shop updates',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [...VIBRATION],
    lightColor: '#000666',
    sound: 'default',
  });
}
