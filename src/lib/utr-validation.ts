import type { ShopOrder } from '@/lib/shop-order-types';
import { hasBalanceUtr } from '@/lib/shop-order-types';

const DIGITS_ONLY = /^\d+$/;

export function isValidUtrLast4(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length === 4 && DIGITS_ONLY.test(trimmed);
}

export function isValidFullUtr(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length === 12 && DIGITS_ONLY.test(trimmed);
}

export function isValidRefundUtr(value: string): boolean {
  return isValidFullUtr(value);
}

export function normalizeRefundUtr(value: string): string {
  return value.trim().replace(/\s/g, '');
}

export type ConfirmUtrFieldMode = {
  mode: 'last4' | 'full12';
  hintLast4?: string;
  balanceMode?: boolean;
};

export function buildConfirmUtrFields(order: ShopOrder, forBalance = false): ConfirmUtrFieldMode {
  if (forBalance && hasBalanceUtr(order)) {
    const utr = order.payment.balance?.utr?.trim() ?? '';
    const hint = utr.length >= 4 ? utr.slice(-4) : undefined;
    return { mode: 'last4', hintLast4: hint, balanceMode: true };
  }

  const customerUtr = order.payment.customerUtr?.trim();
  if (!customerUtr) {
    return { mode: 'full12' };
  }

  const hint = customerUtr.length >= 4 ? customerUtr.slice(-4) : undefined;
  return { mode: 'last4', hintLast4: hint };
}

export type ConfirmUtrBody = { utrLast4?: string; fullUtr?: string };

export function confirmUtrBody(input: {
  customerUtr: string | null | undefined;
  last4: string;
  full12: string;
  forceFull12?: boolean;
  balanceUtr?: string | null;
  forBalance?: boolean;
}): ConfirmUtrBody | null {
  const full = input.full12.trim().replace(/\s/g, '');
  const last4 = input.last4.trim();

  if (input.forceFull12) {
    return isValidFullUtr(full) ? { fullUtr: full } : null;
  }

  if (input.forBalance && input.balanceUtr?.trim()) {
    if (isValidFullUtr(full)) return { fullUtr: full };
    if (isValidUtrLast4(last4)) return { utrLast4: last4 };
    return null;
  }

  const customerUtr = input.customerUtr?.trim();
  if (!customerUtr) {
    return isValidFullUtr(full) ? { fullUtr: full } : null;
  }

  if (isValidFullUtr(full)) return { fullUtr: full };
  if (isValidUtrLast4(last4)) return { utrLast4: last4 };
  return null;
}

export function balanceUtrLast4Source(order: ShopOrder): string | null {
  const utr = order.payment.balance?.utr?.trim();
  if (!utr || utr.length < 4) return null;
  return utr.slice(-4);
}
