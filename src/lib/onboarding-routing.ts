import { Href, router } from 'expo-router';

import { apiUrl } from '@/lib/api';
import { getSessionToken } from '@/lib/session';

export type OnboardingPhase = 'approved' | 'rejected' | 'submitted' | 'incomplete';

export type IncompleteStep = 'business-details' | 'documents' | 'bank-details';

export type OnboardingStatus = {
  phase: OnboardingPhase;
  nextIncompleteStep: IncompleteStep | null;
  rejectionReason: string | null;
  rejectedSection: IncompleteStep | null;
};

export type AuthenticatedRouteOptions = {
  incompleteMessage?: (step: IncompleteStep) => string;
};

type JsonRecord = Record<string, unknown>;

const STEP_ORDER: IncompleteStep[] = ['business-details', 'documents', 'bank-details'];

const STEP_HREF: Record<IncompleteStep, Href> = {
  'business-details': '/(auth)/sign-up/business-details',
  documents: '/(auth)/sign-up/documents',
  'bank-details': '/(auth)/sign-up/bank-details',
};

const STEP_ALIASES: Record<IncompleteStep, string[]> = {
  'business-details': [
    'businessDetails',
    'business_details',
    'business-details',
    'business',
    'businessDetailsCompleted',
  ],
  documents: ['documents', 'document', 'docs', 'documentsCompleted'],
  'bank-details': [
    'bankDetails',
    'bank_details',
    'bank-details',
    'bank',
    'upi',
    'bankDetailsCompleted',
  ],
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' ? (value as JsonRecord) : null;
}

function readString(record: JsonRecord | null, keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return null;
}

function readStep(record: JsonRecord | null, keys: string[]): IncompleteStep | null {
  const value = readString(record, keys);
  if (!value) return null;

  const normalized = value.trim().toLowerCase().replace(/[\s_]+/g, '-');
  return STEP_ORDER.includes(normalized as IncompleteStep)
    ? (normalized as IncompleteStep)
    : null;
}

function readBoolean(record: JsonRecord | null, keys: string[]): boolean | null {
  if (!record) return null;
  for (const key of keys) {
    if (!(key in record)) continue;
    const value = record[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes'].includes(normalized)) return true;
      if (['false', '0', 'no'].includes(normalized)) return false;
    }
    if (typeof value === 'number') {
      if (value === 1) return true;
      if (value === 0) return false;
    }
  }
  return null;
}

function normalizeApprovalStatus(raw: string | null): 'approved' | 'rejected' | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase().replace(/[\s_]+/g, '-');

  if (value === 'approved' || value === 'active' || value === 'live') {
    return 'approved';
  }
  if (value === 'rejected' || value === 'denied') {
    return 'rejected';
  }

  // pending / under-review / etc. are NOT terminal and must not map to "submitted"
  return null;
}

function isStepComplete(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['complete', 'completed', 'done', 'true', 'yes', '1'].includes(normalized);
  }
  return false;
}

function resolveStepsObject(payload: JsonRecord): JsonRecord | null {
  return (
    asRecord(payload.steps) ??
    asRecord(payload.progress) ??
    asRecord(payload.onboardingSteps) ??
    null
  );
}

/**
 * Returns the first incomplete onboarding step in order:
 * Business Details → Documents → Bank Details.
 * If the steps object is missing, assume nothing is done yet.
 */
export function firstIncompleteFromSteps(payload: JsonRecord): IncompleteStep {
  const steps = resolveStepsObject(payload);

  const completedList = Array.isArray(payload.completedSteps)
    ? new Set(
        payload.completedSteps
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim().toLowerCase().replace(/[\s_]+/g, '-')),
      )
    : null;

  for (const step of STEP_ORDER) {
    if (completedList) {
      const aliases = STEP_ALIASES[step].map((alias) =>
        alias.trim().toLowerCase().replace(/[\s_]+/g, '-'),
      );
      const done = aliases.some((alias) => completedList.has(alias) || completedList.has(step));
      if (!done) return step;
      continue;
    }

    if (!steps) {
      return 'business-details';
    }

    let foundKey = false;
    for (const alias of STEP_ALIASES[step]) {
      if (!(alias in steps)) continue;
      foundKey = true;
      if (!isStepComplete(steps[alias])) {
        return step;
      }
      break;
    }

    // Explicit steps object but this step key is absent → treat as incomplete.
    if (!foundKey) {
      return step;
    }
  }

  // All known steps look complete, but application not submitted yet —
  // keep them on the last step (where submit usually lives).
  return 'bank-details';
}

/**
 * Routing rules (explicit):
 * - approvalStatus === 'approved' → Dashboard
 * - approvalStatus === 'rejected' → Resubmit
 * - submitted === true → Application Submitted
 * - submitted === false (even if approvalStatus is pending) → first incomplete step
 */
export function parseOnboardingStatus(payload: unknown): OnboardingStatus {
  const root = asRecord(payload) ?? {};
  const data = asRecord(root.data) ?? root;
  const shop = asRecord(data.shop);

  const approvalStatus = normalizeApprovalStatus(
    readString(data, ['approvalStatus', 'approval_status']) ??
      readString(shop, ['approvalStatus', 'approval_status']),
  );

  if (approvalStatus === 'approved') {
    return {
      phase: 'approved',
      nextIncompleteStep: null,
      rejectionReason: null,
      rejectedSection: null,
    };
  }
  if (approvalStatus === 'rejected') {
    const rejectedSection =
      readStep(data, ['rejectedSection', 'rejected_section']) ??
      readStep(shop, ['rejectedSection', 'rejected_section']);

    return {
      phase: 'rejected',
      nextIncompleteStep: rejectedSection ?? firstIncompleteFromSteps(data),
      rejectionReason:
        readString(data, ['rejectionReason', 'rejection_reason']) ??
        readString(shop, ['rejectionReason', 'rejection_reason']),
      rejectedSection,
    };
  }

  const submitted = readBoolean(data, ['submitted', 'isSubmitted', 'hasSubmitted']);

  if (submitted === true) {
    return {
      phase: 'submitted',
      nextIncompleteStep: null,
      rejectionReason: null,
      rejectedSection: null,
    };
  }

  // submitted === false OR missing → mid-onboarding; never treat pending alone as submitted
  return {
    phase: 'incomplete',
    nextIncompleteStep: firstIncompleteFromSteps(data),
    rejectionReason: null,
    rejectedSection: null,
  };
}

export function hrefForOnboardingStep(step: IncompleteStep): Href {
  return STEP_HREF[step];
}

export function hrefForOnboardingStatus(status: OnboardingStatus): Href {
  switch (status.phase) {
    case 'approved':
      return '/(app)/(dashboard)';
    case 'rejected':
      return '/(auth)/resubmit';
    case 'submitted':
      return '/(auth)/application-submitted';
    case 'incomplete':
    default:
      return hrefForOnboardingStep(status.nextIncompleteStep ?? 'business-details');
  }
}

function replaceIncompleteStepWithMessage(step: IncompleteStep, message: string) {
  switch (step) {
    case 'business-details':
      router.replace({
        pathname: '/(auth)/sign-up/business-details',
        params: { message },
      });
      return;
    case 'documents':
      router.replace({
        pathname: '/(auth)/sign-up/documents',
        params: { message },
      });
      return;
    case 'bank-details':
      router.replace({
        pathname: '/(auth)/sign-up/bank-details',
        params: { message },
      });
      return;
  }
}

export async function fetchOnboardingStatus(token: string): Promise<OnboardingStatus> {
  const response = await fetch(apiUrl('/api/shop/onboarding/status'), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const rawText = await response.text();
  let body: unknown = null;
  try {
    body = rawText ? JSON.parse(rawText) : null;
  } catch {
    console.log('[onboarding/status] raw non-JSON response:', rawText);
    throw new Error('Onboarding status returned invalid JSON');
  }

  // Exact payload for debugging mid-onboarding routing (keep until verified).
  console.log('[onboarding/status] raw JSON:', JSON.stringify(body, null, 2));

  if (!response.ok) {
    throw new Error(`Onboarding status failed with ${response.status}`);
  }

  const parsed = parseOnboardingStatus(body);
  console.log('[onboarding/status] parsed route decision:', parsed);

  return parsed;
}

/**
 * Shared post-auth router for Splash and Login.
 * Returns true when navigation succeeded; false when falling back to Login (§1.1).
 */
export async function routeAfterAuthenticatedSession(
  token?: string | null,
  options?: AuthenticatedRouteOptions,
): Promise<boolean> {
  const sessionToken = token ?? (await getSessionToken());

  if (!sessionToken) {
    router.replace('/(auth)/login');
    return false;
  }

  try {
    const status = await fetchOnboardingStatus(sessionToken);
    if (status.phase === 'incomplete' && status.nextIncompleteStep && options?.incompleteMessage) {
      replaceIncompleteStepWithMessage(
        status.nextIncompleteStep,
        options.incompleteMessage(status.nextIncompleteStep),
      );
    } else {
      router.replace(hrefForOnboardingStatus(status));
    }
    return true;
  } catch (error) {
    console.log('[onboarding/status] routing failed, falling back to login:', error);
    router.replace('/(auth)/login');
    return false;
  }
}
