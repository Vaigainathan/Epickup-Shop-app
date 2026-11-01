import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import renderer, { act } from 'react-test-renderer';

import { ShopPushProvider } from '@/components/ShopPushProvider';
import { resetShopPushNotificationHandlerForTests } from '@/lib/shop-push-notification-handler';

const mockClearLastNotificationResponseAsync = jest
  .fn<() => Promise<void>>()
  .mockResolvedValue(undefined);
const mockGetLastNotificationResponseAsync = jest.fn<() => Promise<unknown>>();
const mockRouterPush = jest.fn<(href: string) => void>();

const mockNoopSub = { remove: jest.fn() };

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  addPushTokenListener: jest.fn(() => mockNoopSub),
  addNotificationReceivedListener: jest.fn(() => mockNoopSub),
  addNotificationResponseReceivedListener: jest.fn(() => mockNoopSub),
  getLastNotificationResponseAsync: () => mockGetLastNotificationResponseAsync(),
  clearLastNotificationResponseAsync: () => mockClearLastNotificationResponseAsync(),
}));

jest.mock('expo-router', () => ({
  router: {
    push: (href: string) => mockRouterPush(href),
  },
}));

jest.mock('@/lib/session', () => ({
  getSessionToken: jest.fn<() => Promise<string | null>>().mockResolvedValue('session-token'),
}));

jest.mock('@/lib/shop-push-registration', () => ({
  registerShopPushFromDevice: jest.fn(),
  onAppForegroundForPush: jest.fn(),
}));

jest.mock('@/lib/shop-notification-channels', () => ({
  ensureShopNotificationChannels: jest.fn(),
}));

jest.mock('@/lib/orders-refresh', () => ({
  requestAllLiveDataRefresh: jest.fn(),
}));

describe('ShopPushProvider cold start', () => {
  beforeEach(() => {
    resetShopPushNotificationHandlerForTests();
    mockClearLastNotificationResponseAsync.mockClear();
    mockRouterPush.mockClear();
    mockGetLastNotificationResponseAsync.mockReset();
  });

  it('second mount after clear does not navigate again', async () => {
    const lastResponse = {
      actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
      notification: {
        date: Date.now(),
        request: {
          identifier: 'cold-start-1',
          content: {
            title: 'Refund',
            body: 'Due',
            data: { type: 'refund_due', orderId: 'ord-remount' },
          },
          trigger: null,
        },
      },
    };

    mockGetLastNotificationResponseAsync
      .mockResolvedValueOnce(lastResponse)
      .mockResolvedValueOnce(null);

    let tree!: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(
        <ShopPushProvider>
          <></>
        </ShopPushProvider>,
      );
      await Promise.resolve();
    });

    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    expect(mockClearLastNotificationResponseAsync).toHaveBeenCalledTimes(1);

    await act(async () => {
      tree.unmount();
    });

    await act(async () => {
      tree = renderer.create(
        <ShopPushProvider>
          <></>
        </ShopPushProvider>,
      );
      await Promise.resolve();
    });

    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    expect(mockGetLastNotificationResponseAsync).toHaveBeenCalledTimes(2);
  });
});
