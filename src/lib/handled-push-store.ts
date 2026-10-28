import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const STORAGE_KEY = 'handled_push_notification_ids';
export const HANDLED_PUSH_MAX_IDS = 20;

async function webGet(key: string): Promise<string | null> {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

async function webSet(key: string, value: string): Promise<void> {
  globalThis.localStorage?.setItem(key, value);
}

async function read(key: string): Promise<string | null> {
  if (await SecureStore.isAvailableAsync()) {
    return SecureStore.getItemAsync(key);
  }
  if (Platform.OS === 'web') {
    return webGet(key);
  }
  return null;
}

async function write(key: string, value: string): Promise<void> {
  if (await SecureStore.isAvailableAsync()) {
    await SecureStore.setItemAsync(key, value);
    return;
  }
  if (Platform.OS === 'web') {
    await webSet(key, value);
  }
}

function parseStoredIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0);
  } catch {
    return [];
  }
}

let cachePromise: Promise<string[]> | null = null;
let cachedIds: string[] | null = null;

async function loadIdsFromStorage(): Promise<string[]> {
  const raw = await read(STORAGE_KEY);
  return parseStoredIds(raw);
}

async function loadHandledIds(): Promise<string[]> {
  if (cachedIds !== null) return cachedIds;
  if (!cachePromise) {
    cachePromise = loadIdsFromStorage()
      .then((ids) => {
        cachedIds = ids;
        return ids;
      })
      .catch((error) => {
        if (__DEV__) {
          console.warn('handled-push-store load failed', error);
        }
        cachedIds = [];
        return [];
      });
  }
  return cachePromise;
}

export async function isHandledPushNotificationId(id: string): Promise<boolean> {
  try {
    const ids = await loadHandledIds();
    return ids.includes(id);
  } catch (error) {
    if (__DEV__) {
      console.warn('handled-push-store isHandled failed', error);
    }
    return false;
  }
}

export async function markHandledPushNotificationId(id: string): Promise<void> {
  try {
    const ids = await loadHandledIds();
    const next = ids.filter((existing) => existing !== id);
    next.push(id);
    while (next.length > HANDLED_PUSH_MAX_IDS) {
      next.shift();
    }
    cachedIds = next;
    cachePromise = Promise.resolve(next);
    await write(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    if (__DEV__) {
      console.warn('handled-push-store mark failed', error);
    }
  }
}

/** @internal test helper */
export function resetHandledPushStoreForTests(): void {
  cachePromise = null;
  cachedIds = null;
}
