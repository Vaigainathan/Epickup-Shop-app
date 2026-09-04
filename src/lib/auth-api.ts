import { apiUrl } from '@/lib/api';
import { fetchShopProfile } from '@/lib/dashboard-api';
import { appendLocalFile } from '@/lib/pick-media';

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

export type PlacePrediction = {
  placeId: string;
  description: string;
  mainText?: string;
  secondaryText?: string;
};

export type PlaceDetails = {
  latitude: number;
  longitude: number;
  formattedAddress: string | null;
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' ? (value as JsonRecord) : null;
}

function readNumber(record: JsonRecord | null, keys: string[]): number | null {
  if (!record) return null;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return null;
}

function readString(record: JsonRecord | null, keys: string[]): string | null {
  if (!record) return null;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return null;
}

function getPlacesData(body: JsonRecord | null): JsonRecord {
  const data = nestedData(body) ?? body ?? {};
  return asRecord(data.result) ?? asRecord(data.place) ?? data;
}

export async function fetchPlaceAutocomplete(
  input: string,
  bearerToken: string,
  signal?: AbortSignal,
): Promise<PlacePrediction[]> {
  const query = new URLSearchParams({ input }).toString();
  const response = await fetch(
    apiUrl(`/api/shop/onboarding/places/autocomplete?${query}`),
    {
      method: 'GET',
      signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${bearerToken}`,
      },
    },
  );

  const body = await parseJson(response);
  if (!response.ok) {
    throw new Error(errorMessage(body, 'Could not search for that place.'));
  }

  const data = nestedData(body) ?? body ?? {};
  const rawPredictions = Array.isArray(data.predictions)
    ? data.predictions
    : Array.isArray(data.results)
      ? data.results
      : [];

  return rawPredictions
    .map((item): PlacePrediction | null => {
      const prediction = asRecord(item);
      const placeId = readString(prediction, ['placeId', 'place_id']);
      const description = readString(prediction, ['description', 'formattedAddress']);
      const formatting = asRecord(prediction?.structured_formatting);

      if (!placeId || !description) return null;

      return {
        placeId,
        description,
        mainText: readString(formatting, ['main_text']) ?? undefined,
        secondaryText: readString(formatting, ['secondary_text']) ?? undefined,
      };
    })
    .filter((prediction): prediction is PlacePrediction => prediction !== null);
}

export async function fetchPlaceDetails(
  placeId: string,
  bearerToken: string,
): Promise<PlaceDetails> {
  const query = new URLSearchParams({ placeId }).toString();
  const response = await fetch(
    apiUrl(`/api/shop/onboarding/places/details?${query}`),
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${bearerToken}`,
      },
    },
  );

  const body = await parseJson(response);
  if (!response.ok) {
    throw new Error(errorMessage(body, 'Could not load that place.'));
  }

  const data = getPlacesData(body);
  const geometry = asRecord(data.geometry);
  const coordinates = asRecord(geometry?.location) ?? asRecord(data.location) ?? data;
  const latitude = readNumber(coordinates, ['lat', 'latitude']);
  const longitude = readNumber(coordinates, ['lng', 'lon', 'longitude']);

  if (latitude === null || longitude === null) {
    throw new Error('That place did not include a map location.');
  }

  return {
    latitude,
    longitude,
    formattedAddress: readString(data, ['formatted_address', 'formattedAddress', 'address']),
  };
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

export type OnboardingDocumentField = 'gst' | 'fssai';

export type OnboardingDocumentFile = {
  uri: string;
  mimeType: string;
  fileName: string;
};

export async function uploadShopOnboardingDocument(
  field: OnboardingDocumentField,
  file: OnboardingDocumentFile,
  bearerToken: string,
) {
  const form = new FormData();
  await appendLocalFile(form, field, file);

  const response = await fetch(apiUrl('/api/shop/onboarding/documents'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${bearerToken}`,
    },
    body: form,
  });

  const body = await parseJson(response);
  if (!response.ok) {
    throw new Error(errorMessage(body, 'Could not upload this document.'));
  }

  return body ?? {};
}

export async function saveShopBusinessDetails(
  details: {
    shopName: string;
    shopType: string;
    address: string;
    location: { lat: number; lng: number };
  },
  bearerToken: string,
) {
  const response = await fetch(apiUrl('/api/shop/onboarding/business-details'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bearerToken}`,
    },
    body: JSON.stringify(details),
  });

  const body = await parseJson(response);
  if (!response.ok) {
    throw new Error(errorMessage(body, 'Could not save your business details.'));
  }

  return body ?? {};
}

export async function verifyShopUpi(upiId: string, bearerToken: string) {
  const response = await fetch(apiUrl('/api/shop/onboarding/verify-upi'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bearerToken}`,
    },
    body: JSON.stringify({ upiId }),
  });

  const body = await parseJson(response);
  if (!response.ok) {
    throw new Error(errorMessage(body, 'Could not verify this UPI ID.'));
  }

  return body ?? {};
}

export async function saveShopBankDetails(
  details: {
    accountHolderName: string;
    bankName: string;
    accountNumber: string;
    ifsc: string;
    upiId: string;
  },
  bearerToken: string,
) {
  const response = await fetch(apiUrl('/api/shop/onboarding/bank-details'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bearerToken}`,
    },
    body: JSON.stringify(details),
  });

  const body = await parseJson(response);
  if (!response.ok) {
    throw new Error(errorMessage(body, 'Could not save your bank details.'));
  }

  return body ?? {};
}

export async function submitShopOnboarding(bearerToken: string) {
  const response = await fetch(apiUrl('/api/shop/onboarding/submit'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bearerToken}`,
    },
    body: JSON.stringify({}),
  });

  const body = await parseJson(response);
  if (!response.ok) {
    throw new Error(errorMessage(body, 'Could not submit your application.'));
  }

  return body ?? {};
}

export async function fetchShopType(): Promise<string | null> {
  try {
    const profile = await fetchShopProfile();
    return profile.shopType;
  } catch {
    return null;
  }
}
