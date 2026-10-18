import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  registerShopPushToken,
  unregisterShopPushToken,
  withTimeout,
} from '@/lib/fcm-tokens-api';
import { getSessionToken } from '@/lib/session';

let lastRegisteredToken: string | null = null;

function projectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#000666',
  });
}

async function obtainExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;
  const pid = projectId();
  if (!pid) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  await ensureAndroidChannel();
  const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId: pid });
  return tokenResult.data ?? null;
}

export async function registerShopPushFromDevice(): Promise<void> {
  const session = await getSessionToken();
  if (!session) return;

  const token = await obtainExpoPushToken();
  if (!token) return;
  if (token === lastRegisteredToken) return;

  try {
    await registerShopPushToken(token, Platform.OS);
    lastRegisteredToken = token;
  } catch {
    // silent
  }
}

export async function unregisterShopPushBestEffort(): Promise<void> {
  const token = lastRegisteredToken;
  if (!token) return;
  try {
    await withTimeout(unregisterShopPushToken(token), 3000);
  } catch {
    // continue logout
  } finally {
    lastRegisteredToken = null;
  }
}
