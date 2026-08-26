import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'session_token';

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
  const keys = ['token', 'idToken', 'accessToken', 'jwt', 'sessionToken'] as const;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
    const nestedValue = nested?.[key];
    if (typeof nestedValue === 'string' && nestedValue.length > 0) {
      return nestedValue;
    }
  }

  return null;
}

export async function getSessionToken(): Promise<string | null> {
  if (await SecureStore.isAvailableAsync()) {
    return SecureStore.getItemAsync(TOKEN_KEY);
  }

  if (Platform.OS === 'web') {
    return webGet(TOKEN_KEY);
  }

  return null;
}

export async function setSessionToken(token: string): Promise<void> {
  if (await SecureStore.isAvailableAsync()) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    return;
  }

  if (Platform.OS === 'web') {
    await webSet(TOKEN_KEY, token);
  }
}

export async function clearSessionToken(): Promise<void> {
  if (await SecureStore.isAvailableAsync()) {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    return;
  }

  if (Platform.OS === 'web') {
    await webRemove(TOKEN_KEY);
  }
}
