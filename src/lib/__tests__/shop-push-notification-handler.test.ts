import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { NotificationResponse } from 'expo-notifications';

import {
  handleNotificationResponse,
  resetShopPushNotificationHandlerForTests,
} from '@/lib/shop-push-notification-handler';
import { getSessionToken } from '@/lib/session';

const mockClearLastNotificationResponseAsync = jest
  .fn<() => Promise<void>>()
  .mockResolvedValue(undefined);
const mockRouterPush = jest.fn<(href: string) => void>();
const mockIsHandledPushNotificationId = jest
  .fn<(id: string) => Promise<boolean>>()
  .mockResolvedValue(false);
const mockMarkHandledPushNotificationId = jest
  .fn<(id: string) => Promise<void>>()
  .mockResolvedValue(undefined);

jest.mock('expo-notifications', () => ({
  clearLastNotificationResponseAsync: () => mockClearLastNotificationResponseAsync(),
}));

jest.mock('expo-router', () => ({
  router: {
    push: (href: string) => mockRouterPush(href),
  },
}));

jest.mock('@/lib/handled-push-store', () => ({
  isHandledPushNotificationId: (id: string) => mockIsHandledPushNotificationId(id),
  markHandledPushNotificationId: (id: string) => mockMarkHandledPushNotificationId(id),
  resetHandledPushStoreForTests: jest.fn(),
}));

jest.mock('@/lib/session', () => ({
  getSessionToken: jest.fn(),
}));

const mockGetSessionToken = getSessionToken as jest.MockedFunction<typeof getSessionToken>;

function makeResponse(
  data: Record<string, unknown>,
  options?: { id?: string; date?: number },
): NotificationResponse {
  const id = options?.id ?? 'notif-1';
  return {
    actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
    notification: {
      date: options?.date ?? Date.now(),
      request: {
        identifier: id,
        content: {
          title: 'Test',
          body: 'Body',
          data,
        },
        trigger: null,
      },
    },
  } as NotificationResponse;
}

describe('shop-push-notification-handler', () => {
  beforeEach(() => {
    resetShopPushNotificationHandlerForTests();
    mockClearLastNotificationResponseAsync.mockClear();
    mockRouterPush.mockClear();
    mockGetSessionToken.mockReset();
    mockIsHandledPushNotificationId.mockReset();
    mockIsHandledPushNotificationId.mockResolvedValue(false);
    mockMarkHandledPushNotificationId.mockReset();
    mockMarkHandledPushNotificationId.mockResolvedValue(undefined);
  });

  it('navigates once then clears', async () => {
    mockGetSessionToken.mockResolvedValue('token');
    const response = makeResponse({ type: 'refund_due', orderId: 'ord-1' });

    await handleNotificationResponse(response);

    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).toHaveBeenCalledWith('/(app)/(refunds)?orderId=ord-1');
    expect(mockClearLastNotificationResponseAsync).toHaveBeenCalledTimes(1);
  });

  it('no session → no navigate, no clear; then with session → navigates once', async () => {
    const response = makeResponse({ type: 'refund_due', orderId: 'ord-1' });

    mockGetSessionToken.mockResolvedValue(null);
    await handleNotificationResponse(response);
    expect(mockRouterPush).not.toHaveBeenCalled();
    expect(mockClearLastNotificationResponseAsync).not.toHaveBeenCalled();

    mockGetSessionToken.mockResolvedValue('token');
    await handleNotificationResponse(response);
    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    expect(mockClearLastNotificationResponseAsync).toHaveBeenCalledTimes(1);
  });

  it('dedupes same id: second handle does not navigate again', async () => {
    mockGetSessionToken.mockResolvedValue('token');
    const response = makeResponse({ type: 'incoming_payment', orderId: 'ord-2' });

    await handleNotificationResponse(response);
    await handleNotificationResponse(response);

    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    expect(mockClearLastNotificationResponseAsync).toHaveBeenCalledTimes(1);
  });

  it('response with a 3-hour-old notification date still navigates once and is cleared', async () => {
    mockGetSessionToken.mockResolvedValue('token');
    const threeHoursMs = 3 * 60 * 60 * 1000;
    const response = makeResponse(
      { type: 'refund_due', orderId: 'ord-old' },
      { date: Date.now() - threeHoursMs },
    );

    await handleNotificationResponse(response);

    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).toHaveBeenCalledWith('/(app)/(refunds)?orderId=ord-old');
    expect(mockClearLastNotificationResponseAsync).toHaveBeenCalledTimes(1);
  });

  it('same id from listener and cold start in one session navigates once', async () => {
    mockGetSessionToken.mockResolvedValue('token');
    const response = makeResponse({ type: 'refund_overdue', orderId: 'ord-3' }, { id: 'shared-id' });

    await handleNotificationResponse(response);
    await handleNotificationResponse(response);

    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    expect(mockClearLastNotificationResponseAsync).toHaveBeenCalledTimes(1);
  });

  it("ignore type clears and does not navigate", async () => {
    mockGetSessionToken.mockResolvedValue('token');
    const response = makeResponse({ type: 'unknown_type', orderId: 'x' });

    await handleNotificationResponse(response);

    expect(mockRouterPush).not.toHaveBeenCalled();
    expect(mockClearLastNotificationResponseAsync).toHaveBeenCalledTimes(1);
  });

  it('concurrent same id → one router.push and one clear', async () => {
    let resolveToken!: (value: string | null) => void;
    const tokenDeferred = new Promise<string | null>((resolve) => {
      resolveToken = resolve;
    });
    mockGetSessionToken.mockImplementation(() => tokenDeferred);

    const response = makeResponse(
      { type: 'refund_due', orderId: 'ord-race' },
      { id: 'race-concurrent' },
    );

    const first = handleNotificationResponse(response);
    const second = handleNotificationResponse(response);
    await Promise.resolve();
    resolveToken('token');
    await Promise.all([first, second]);

    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    expect(mockClearLastNotificationResponseAsync).toHaveBeenCalledTimes(1);
  });

  it('persisted id → no navigation, no clear', async () => {
    mockGetSessionToken.mockResolvedValue('token');
    mockIsHandledPushNotificationId.mockResolvedValue(true);
    const response = makeResponse({ type: 'refund_due', orderId: 'ord-persisted' }, { id: 'stored-id' });

    await handleNotificationResponse(response);

    expect(mockRouterPush).not.toHaveBeenCalled();
    expect(mockClearLastNotificationResponseAsync).not.toHaveBeenCalled();
    expect(mockMarkHandledPushNotificationId).not.toHaveBeenCalled();
  });

  it('new id navigates and is persisted', async () => {
    mockGetSessionToken.mockResolvedValue('token');
    const response = makeResponse({ type: 'refund_due', orderId: 'ord-new' }, { id: 'fresh-id' });

    await handleNotificationResponse(response);

    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    expect(mockMarkHandledPushNotificationId).toHaveBeenCalledWith('fresh-id');
    expect(mockClearLastNotificationResponseAsync).toHaveBeenCalledTimes(1);
  });

  it('storage read failure (not handled) → still navigates once', async () => {
    mockGetSessionToken.mockResolvedValue('token');
    mockIsHandledPushNotificationId.mockResolvedValue(false);
    const response = makeResponse({ type: 'incoming_payment', orderId: 'ord-read-fail' });

    await handleNotificationResponse(response);

    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    expect(mockMarkHandledPushNotificationId).toHaveBeenCalledTimes(1);
  });
});
