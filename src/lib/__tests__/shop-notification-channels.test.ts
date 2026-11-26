import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockSetNotificationChannelAsync = jest
  .fn<(...args: unknown[]) => Promise<null>>()
  .mockResolvedValue(null);

jest.mock('react-native', () => ({
  Platform: { OS: 'android' as const },
}));

jest.mock('expo-notifications', () => ({
  AndroidImportance: {
    DEFAULT: 5,
    HIGH: 6,
  },
  AndroidAudioUsage: {
    NOTIFICATION: 5,
  },
  AndroidAudioContentType: {
    SONIFICATION: 4,
  },
  setNotificationChannelAsync: (...args: unknown[]) => mockSetNotificationChannelAsync(...args),
}));

jest.mock('@/lib/shop-push-register-retry', () => ({
  devPushLog: jest.fn(),
}));

import { AndroidImportance } from 'expo-notifications';

import {
  ensureShopNotificationChannels,
  resetShopNotificationChannelsForTests,
  SHOP_NEW_ORDER_V2_SOUND,
  SHOP_ORDERS_V2_CHANNEL_ID,
  SHOP_REMINDER_V2_SOUND,
  SHOP_REMINDERS_V2_CHANNEL_ID,
} from '@/lib/shop-notification-channels';

describe('shop-notification-channels', () => {
  beforeEach(() => {
    resetShopNotificationChannelsForTests();
    mockSetNotificationChannelAsync.mockClear();
  });

  it('exports ring channel and sound constants', () => {
    expect(SHOP_ORDERS_V2_CHANNEL_ID).toBe('shop_orders_v2');
    expect(SHOP_REMINDERS_V2_CHANNEL_ID).toBe('shop_reminders_v2');
    expect(SHOP_NEW_ORDER_V2_SOUND).toBe('shop_new_order_v2.wav');
    expect(SHOP_REMINDER_V2_SOUND).toBe('shop_reminder_v2.wav');
  });

  it('ensureShopNotificationChannels registers v2 channels with HIGH importance and custom sounds', async () => {
    await ensureShopNotificationChannels();

    const ordersConfig = mockSetNotificationChannelAsync.mock.calls.find(
      (call) => call[0] === SHOP_ORDERS_V2_CHANNEL_ID,
    )?.[1] as { importance: number; sound: string } | undefined;
    const remindersConfig = mockSetNotificationChannelAsync.mock.calls.find(
      (call) => call[0] === SHOP_REMINDERS_V2_CHANNEL_ID,
    )?.[1] as { importance: number; sound: string } | undefined;

    expect(ordersConfig).toBeDefined();
    expect(ordersConfig!.importance).toBe(AndroidImportance.HIGH);
    expect(ordersConfig!.sound).toBe(SHOP_NEW_ORDER_V2_SOUND);

    expect(remindersConfig).toBeDefined();
    expect(remindersConfig!.importance).toBe(AndroidImportance.HIGH);
    expect(remindersConfig!.sound).toBe(SHOP_REMINDER_V2_SOUND);
  });
});