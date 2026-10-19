const REASON_COPY: Record<string, string> = {
  customer_cancel: 'Customer cancelled after paying',
  shop_cancel: 'You cancelled this order',
  amount_short_cancel: 'Customer cancelled — amount was short',
  balance_expired: 'Balance not paid in time',
  overpaid: 'Customer paid more than expected',
  late_unfulfilled: 'Late payment — you chose to refund',
  paid_on_cancelled: 'Payment found after order was closed',
  review_refund: 'Payment review — refund agreed',
  stock_short: 'Items unavailable',
  support_decision: 'Support decision',
};

export function refundReasonCopy(reason: string | null | undefined): string {
  if (!reason?.trim()) return 'Refund due';
  const key = reason.trim();
  return REASON_COPY[key] ?? 'Refund due';
}
