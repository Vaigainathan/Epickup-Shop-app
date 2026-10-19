import { describe, expect, it } from '@jest/globals';

import { formatRefundListRow, isRefundOverdue } from '@/lib/refund-format';
import { refundReasonCopy } from '@/lib/refund-reason-copy';
import type { ShopRefundListItem } from '@/lib/refunds-api';

describe('refund-format', () => {
  it('maps reason copy', () => {
    expect(refundReasonCopy('balance_expired')).toContain('Balance');
  });

  it('flags overdue when dueBy passed', () => {
    const past = new Date('2020-01-01T12:00:00Z');
    expect(isRefundOverdue(past, new Date('2026-01-01T12:00:00Z'))).toBe(true);
  });

  it('formats list row', () => {
    const refund: ShopRefundListItem = {
      id: 'r1',
      orderId: 'o1',
      displayId: 42,
      customerName: 'Priya',
      reason: 'customer_cancel',
      status: 'due',
      amount: 200,
      dueBy: new Date('2030-06-01T10:30:00Z'),
      customerUpiId: 'a@upi',
      refundUtr: null,
      sentAmount: null,
    };
    const row = formatRefundListRow(refund);
    expect(row.title).toBe('Priya');
    expect(row.subtitle).toBe('#00042');
    expect(row.reasonLine).toContain('cancelled');
  });
});
