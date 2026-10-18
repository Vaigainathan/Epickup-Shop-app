import { apiUrl } from '@/lib/api';
import { getSessionToken } from '@/lib/session';

export async function registerShopPushToken(token: string, platform: string): Promise<void> {
  const sessionToken = await getSessionToken();
  if (!sessionToken) return;

  const response = await fetch(apiUrl('/api/fcm-tokens/register'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({
      token,
      platform,
      userType: 'shop',
    }),
  });

  if (!response.ok) {
    throw new Error(`Push register failed: ${response.status}`);
  }
}

export async function unregisterShopPushToken(token: string): Promise<void> {
  const sessionToken = await getSessionToken();
  if (!sessionToken) return;

  const response = await fetch(apiUrl('/api/fcm-tokens/unregister'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    throw new Error(`Push unregister failed: ${response.status}`);
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}
