import { GENERIC_API_ERROR } from '@/lib/api-error-messages';

export function onboardingStatusErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message === 'Your session expired. Please log in again.') {
    return error.message;
  }
  if (error instanceof Error && error.message === 'Onboarding status returned invalid JSON') {
    return GENERIC_API_ERROR;
  }
  if (error instanceof Error && error.message.startsWith('Onboarding status failed with')) {
    return GENERIC_API_ERROR;
  }
  return fallback;
}
