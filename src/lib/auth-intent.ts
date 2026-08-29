export const RESET_INTENT = 'reset';

export function isResetIntent(value: string | string[] | undefined): boolean {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === RESET_INTENT;
}
