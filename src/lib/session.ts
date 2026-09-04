import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'session_token';
const REFRESH_TOKEN_KEY = 'session_refresh_token';

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

async function webRemove(key: string): Promise<void> {
  globalThis.localStorage?.removeItem(key);
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

async function remove(key: string): Promise<void> {
  if (await SecureStore.isAvailableAsync()) {
    await SecureStore.deleteItemAsync(key);
    return;
  }
  if (Platform.OS === 'web') {
    await webRemove(key);
  }
}

function readStringField(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return null;
}

export function extractSessionToken(payload: unknown): string | null {
  if (typeof payload === 'string' && payload.length > 0) {
    return payload;
  }

  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const nested =
    record.data && typeof record.data === 'object'
      ? (record.data as Record<string, unknown>)
      : null;

  return (
    readStringField(record, ['token', 'idToken', 'accessToken', 'jwt', 'sessionToken']) ??
    (nested
      ? readStringField(nested, ['token', 'idToken', 'accessToken', 'jwt', 'sessionToken'])
      : null)
  );
}

export function extractRefreshToken(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const nested =
    record.data && typeof record.data === 'object'
      ? (record.data as Record<string, unknown>)
      : null;

  return (
    readStringField(record, ['refreshToken', 'refresh_token']) ??
    (nested ? readStringField(nested, ['refreshToken', 'refresh_token']) : null)
  );
}

export async function getSessionToken(): Promise<string | null> {
  return read(TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return read(REFRESH_TOKEN_KEY);
}

export async function setSessionToken(token: string): Promise<void> {
  await write(TOKEN_KEY, token);
}

export async function setRefreshToken(token: string): Promise<void> {
  await write(REFRESH_TOKEN_KEY, token);
}

export async function setSessionTokens(token: string, refreshToken?: string | null): Promise<void> {
  await setSessionToken(token);
  if (refreshToken) {
    await setRefreshToken(refreshToken);
  }
}

export async function clearSessionToken(): Promise<void> {
  await remove(TOKEN_KEY);
  await remove(REFRESH_TOKEN_KEY);
}

export async function sessionTokensAreCleared(): Promise<boolean> {
  const [access, refresh] = await Promise.all([getSessionToken(), getRefreshToken()]);
  return access === null && refresh === null;
}

/** Wipes access + refresh, then re-reads storage to confirm both are gone. */
export async function wipeShopSession(): Promise<boolean> {
  await clearSessionToken();
  if (await sessionTokensAreCleared()) return true;
  await clearSessionToken();
  return sessionTokensAreCleared();
}
