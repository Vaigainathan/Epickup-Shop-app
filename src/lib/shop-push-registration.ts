import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  registerShopPushToken,
  unregisterShopPushToken,
  withTimeout,
} from '@/lib/fcm-tokens-api';
import { ensureShopNotificationChannels } from '@/lib/shop-notification-channels';
import { devPushLog, withRetries } from '@/lib/shop-push-register-retry';
import { getSessionRegistrationKey, getSessionToken } from '@/lib/session';

let lastRegisteredToken: string | null = null;
let lastRegisteredSessionKey: string | null = null;

function projectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
}

export type PushObtainResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'not_device' | 'no_project' | 'permission_denied' | 'obtain_failed' };

export async function obtainExpoPushTokenWithStatus(): Promise<PushObtainResult> {
  if (!Device.isDevice) return { ok: false, reason: 'not_device' };
  const pid = projectId();
  if (!pid) return { ok: false, reason: 'no_project' };

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return { ok: false, reason: 'permission_denied' };

  await ensureShopNotificationChannels();

  try {
    const tokenResult = await withRetries('getExpoPushTokenAsync', () =>
      Notifications.getExpoPushTokenAsync({ projectId: pid }),
    );
    const token = tokenResult.data ?? null;
    if (!token) return { ok: false, reason: 'obtain_failed' };
    return { ok: true, token };
  } catch (error) {
    devPushLog('getExpoPushTokenAsync failed', error);
    return { ok: false, reason: 'obtain_failed' };
  }
}

export async function registerShopPushFromDevice(): Promise<void> {
  const session = await getSessionToken();
  if (!session) return;

  const sessionKey = await getSessionRegistrationKey();
  const obtained = await obtainExpoPushTokenWithStatus();
  if (!obtained.ok) return;

  const token = obtained.token;
  if (token === lastRegisteredToken && sessionKey === lastRegisteredSessionKey) return;

  try {
    await withRetries('registerShopPushToken', () => registerShopPushToken(token, Platform.OS));
    lastRegisteredToken = token;
    lastRegisteredSessionKey = sessionKey;
  } catch (error) {
    devPushLog('registerShopPushToken failed', error);
  }
}

export async function unregisterShopPushBestEffort(): Promise<void> {
  const token = lastRegisteredToken;
  if (!token) {
    lastRegisteredSessionKey = null;
    return;
  }
  try {
    await withTimeout(unregisterShopPushToken(token), 3000);
  } catch (error) {
    devPushLog('unregisterShopPushToken failed', error);
  } finally {
    lastRegisteredToken = null;
    lastRegisteredSessionKey = null;
  }
}

/** Called when app returns to foreground — register + channel ensure. */
export function onAppForegroundForPush(): void {
  void ensureShopNotificationChannels();
  void registerShopPushFromDevice();
}

/** @internal test helper */
export function resetShopPushRegistrationForTests(): void {
  lastRegisteredToken = null;
  lastRegisteredSessionKey = null;
}
