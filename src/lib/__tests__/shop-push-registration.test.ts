import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { registerShopPushToken } from '@/lib/fcm-tokens-api';
import {
  registerShopPushFromDevice,
  resetShopPushRegistrationForTests,
} from '@/lib/shop-push-registration';
import { getSessionRegistrationKey, getSessionToken } from '@/lib/session';

jest.mock('@/lib/fcm-tokens-api', () => ({
  registerShopPushToken: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  unregisterShopPushToken: jest.fn(),
  withTimeout: jest.fn((p: Promise<unknown>) => p),
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest
    .fn<() => Promise<{ status: string }>>()
    .mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest
    .fn<() => Promise<{ data: string }>>()
    .mockResolvedValue({ data: 'expo-token-1' }),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
}));

jest.mock('expo-device', () => ({
  isDevice: true,
}));

jest.mock('expo-constants', () => ({
  expoConfig: { extra: { eas: { projectId: 'test-project' } } },
}));

jest.mock('@/lib/shop-notification-channels', () => ({
  ensureShopNotificationChannels: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));

jest.mock('@/lib/session', () => ({
  getSessionToken: jest.fn(),
  getSessionRegistrationKey: jest.fn(),
}));

const mockRegister = registerShopPushToken as jest.MockedFunction<typeof registerShopPushToken>;
const mockGetSession = getSessionToken as jest.MockedFunction<typeof getSessionToken>;
const mockSessionKey = getSessionRegistrationKey as jest.MockedFunction<
  typeof getSessionRegistrationKey
>;

describe('registerShopPushFromDevice', () => {
  beforeEach(() => {
    resetShopPushRegistrationForTests();
    mockRegister.mockClear();
    mockGetSession.mockResolvedValue('session-a');
    mockSessionKey.mockResolvedValue('session-a');
  });

  it('re-registers when session key changes even if token unchanged', async () => {
    await registerShopPushFromDevice();
    expect(mockRegister).toHaveBeenCalledTimes(1);

    mockSessionKey.mockResolvedValue('session-b');
    await registerShopPushFromDevice();
    expect(mockRegister).toHaveBeenCalledTimes(2);
  });
});
