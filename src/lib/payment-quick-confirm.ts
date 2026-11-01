import type { ShopOrder } from '@/lib/shop-order-types';
import type { ShopActionId } from '@/lib/shop-order-actions';

export function customerUtrLast4(customerUtr: string | null | undefined): string | null {
  const trimmed = customerUtr?.trim();
  if (!trimmed || trimmed.length < 4) return null;
  return trimmed.slice(-4);
}

export function canQuickConfirmPayment(order: ShopOrder, actionId: ShopActionId): boolean {
  if (actionId !== 'confirm_received') return false;
  return customerUtrLast4(order.payment.customerUtr) !== null;
}

export function quickConfirmPrimaryLabel(order: ShopOrder): string {
  const amount = order.expectedAmount ?? order.payment.amount;
  const last4 = customerUtrLast4(order.payment.customerUtr) ?? '????';
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
  return `I've received ${formatted} in my UPI app (UTR ••${last4}) — Confirm`;
}
