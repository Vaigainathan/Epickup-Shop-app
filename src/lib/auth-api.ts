import { apiUrl } from '@/lib/api';

type JsonRecord = Record<string, unknown>;

async function parseJson(response: Response): Promise<JsonRecord | null> {
  try {
    const body = await response.json();
    return body && typeof body === 'object' ? (body as JsonRecord) : null;
  } catch {
    return null;
  }
}

function nestedData(body: JsonRecord | null): JsonRecord | null {
  if (!body) return null;
  return body.data && typeof body.data === 'object' ? (body.data as JsonRecord) : null;
}

function errorMessage(body: JsonRecord | null, fallback: string): string {
  if (!body) return fallback;

  if (typeof body.error === 'string' && body.error.length > 0) {
    return body.error;
  }

  if (body.error && typeof body.error === 'object') {
    const message = (body.error as JsonRecord).message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }

  if (typeof body.message === 'string' && body.message.length > 0) {
    return body.message;
  }

  return fallback;
}

export async function checkShopPhone(phoneE164: string) {
  const response = await fetch(apiUrl('/api/auth/check-phone'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phoneNumber: phoneE164,
      userType: 'shop',
    }),
  });

  const body = await parseJson(response);
  if (!response.ok) {
    throw new Error(errorMessage(body, 'Could not verify this phone number.'));
  }

  const data = nestedData(body) ?? body ?? {};
  const exists = Boolean(data.exists ?? data.registered ?? data.isRegistered ?? data.alreadyExists);

  return {
    exists,
    message: typeof data.message === 'string' ? data.message : null,
  };
}

export async function verifyFirebaseShopToken(idToken: string) {
  const response = await fetch(apiUrl('/api/auth/firebase/verify-token'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      idToken,
      userType: 'shop',
    }),
  });

  const body = await parseJson(response);
  if (!response.ok) {
    throw new Error(errorMessage(body, 'Could not verify OTP with the server.'));
  }

  return body ?? {};
}

export async function setShopPassword(password: string, bearerToken: string) {
  const response = await fetch(apiUrl('/api/shop/auth/set-password'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bearerToken}`,
    },
    body: JSON.stringify({ password }),
  });

  const body = await parseJson(response);
  if (!response.ok) {
    throw new Error(errorMessage(body, 'Could not save your password.'));
  }

  return body ?? {};
}
