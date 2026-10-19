export const UPI_REGISTERED_NAME_MIN = 1;
export const UPI_REGISTERED_NAME_MAX = 100;

export function validateUpiRegisteredName(raw: string): { ok: true; value: string } | { ok: false } {
  const value = raw.trim();
  if (value.length < UPI_REGISTERED_NAME_MIN || value.length > UPI_REGISTERED_NAME_MAX) {
    return { ok: false };
  }
  return { ok: true, value };
}
