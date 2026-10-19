import { formatDisplayId, formatInr, formatIstTime } from '@/lib/orders-api';
import { refundReasonCopy } from '@/lib/refund-reason-copy';
import type { ShopRefundListItem } from '@/lib/refunds-api';

export type RefundListRowDisplay = {
  title: string;
  subtitle: string;
  amountLabel: string;
  dueLabel: string | null;
  overdue: boolean;
  reasonLine: string;
};

export function isRefundOverdue(dueBy: Date | null, now: Date = new Date()): boolean {
  if (!dueBy) return false;
  return dueBy.getTime() < now.getTime();
}

export function formatRefundListRow(
  refund: ShopRefundListItem,
  now: Date = new Date(),
): RefundListRowDisplay {
  const name = refund.customerName?.trim() || 'Customer';
  const display = formatDisplayId(refund.displayId);
  const amountLabel = formatInr(refund.amount ?? 0);
  const dueTime = formatIstTime(refund.dueBy);
  const overdue = refund.status === 'overdue' || isRefundOverdue(refund.dueBy, now);
  const dueLabel =
    dueTime && (refund.status === 'due' || refund.status === 'overdue')
      ? `Due by ${dueTime} IST`
      : refund.status === 'sent'
        ? 'Waiting for customer confirmation'
        : null;

  return {
    title: name,
    subtitle: display,
    amountLabel,
    dueLabel,
    overdue,
    reasonLine: refundReasonCopy(refund.reason),
  };
}
