import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

import { obtainExpoPushTokenWithStatus } from '@/lib/shop-push-registration';

export type NotificationPermissionBannerState =
  | 'granted'
  | 'denied'
  | 'undetermined'
  | 'no_token';

export async function probeNotificationPermissionForBanner(): Promise<NotificationPermissionBannerState> {
  if (!Device.isDevice) return 'granted';

  const pid = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!pid) return 'no_token';

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    return status === 'denied' ? 'denied' : 'undetermined';
  }

  const obtained = await obtainExpoPushTokenWithStatus();
  if (!obtained.ok && obtained.reason !== 'permission_denied') {
    return 'no_token';
  }
  if (!obtained.ok) return 'denied';
  return 'granted';
}

export function shouldShowNotificationsOffBanner(state: NotificationPermissionBannerState): boolean {
  return state !== 'granted';
}
