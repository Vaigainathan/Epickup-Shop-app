export const GENERIC_API_ERROR = 'Something went wrong. Try again.';

export const SESSION_EXPIRED_COPY = 'Your session expired. Please log in again.';

export type ApiErrorLike = {
  status: number;
  code: string | null;
};

export function mapApiErrorCode(
  error: ApiErrorLike,
  codes: Record<string, string>,
  fallback: string = GENERIC_API_ERROR,
): string {
  if (error.status === 401 || error.code === 'UNAUTHENTICATED') {
    return SESSION_EXPIRED_COPY;
  }
  if (error.code && codes[error.code]) {
    return codes[error.code];
  }
  if (error.code === 'NETWORK_ERROR') {
    return fallback || 'Check your connection and try again.';
  }
  return GENERIC_API_ERROR;
}
