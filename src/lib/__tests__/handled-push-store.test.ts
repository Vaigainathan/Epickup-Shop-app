import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  HANDLED_PUSH_MAX_IDS,
  isHandledPushNotificationId,
  markHandledPushNotificationId,
  resetHandledPushStoreForTests,
} from '@/lib/handled-push-store';

let mockStored: string | null = null;

const mockIsAvailableAsync = jest.fn<() => Promise<boolean>>().mockResolvedValue(true);
const mockGetItemAsync = jest.fn<(key: string) => Promise<string | null>>();
const mockSetItemAsync = jest.fn<(key: string, value: string) => Promise<void>>();

jest.mock('expo-secure-store', () => ({
  isAvailableAsync: () => mockIsAvailableAsync(),
  getItemAsync: (key: string) => mockGetItemAsync(key),
  setItemAsync: (key: string, value: string) => mockSetItemAsync(key, value),
}));

describe('handled-push-store', () => {
  beforeEach(() => {
    mockStored = null;
    resetHandledPushStoreForTests();
    mockIsAvailableAsync.mockResolvedValue(true);
    mockGetItemAsync.mockImplementation(() => Promise.resolve(mockStored));
    mockSetItemAsync.mockImplementation((_key, value) => {
      mockStored = value;
      return Promise.resolve();
    });
  });

  it('isHandled is false until marked', async () => {
    expect(await isHandledPushNotificationId('a')).toBe(false);
    await markHandledPushNotificationId('a');
    expect(await isHandledPushNotificationId('a')).toBe(true);
  });

  it('isHandled returns false when storage read fails', async () => {
    mockGetItemAsync.mockRejectedValueOnce(new Error('read failed'));
    resetHandledPushStoreForTests();

    expect(await isHandledPushNotificationId('any')).toBe(false);
  });

  it(`keeps at most ${HANDLED_PUSH_MAX_IDS} ids (FIFO)`, async () => {
    for (let i = 0; i <= HANDLED_PUSH_MAX_IDS; i += 1) {
      await markHandledPushNotificationId(`id-${i}`);
    }

    expect(mockStored).not.toBeNull();
    const stored = JSON.parse(mockStored!) as string[];
    expect(stored).toHaveLength(HANDLED_PUSH_MAX_IDS);
    expect(stored).not.toContain('id-0');
    expect(stored).toContain(`id-${HANDLED_PUSH_MAX_IDS}`);
    expect(await isHandledPushNotificationId('id-0')).toBe(false);
    expect(await isHandledPushNotificationId(`id-${HANDLED_PUSH_MAX_IDS}`)).toBe(true);
  });
});
