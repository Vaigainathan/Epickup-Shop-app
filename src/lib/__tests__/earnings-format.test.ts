import { describe, expect, it } from '@jest/globals';

import {
  earningsPeriodContextLabel,
  formatRefundedDisplay,
} from '@/lib/earnings-format';
import { formatInr } from '@/lib/orders-api';

describe('formatRefundedDisplay', () => {
  it('shows ₹0 when refunded is zero', () => {
    expect(formatRefundedDisplay(0, formatInr)).toBe(formatInr(0));
  });

  it('prefixes non-zero refunded amounts with a minus', () => {
    const label = formatRefundedDisplay(100, formatInr);
    expect(label.startsWith('− ')).toBe(true);
    expect(label).toContain(formatInr(100));
  });
});

describe('earningsPeriodContextLabel', () => {
  const asOf = new Date('2026-10-29T15:30:00+05:30');

  it('shows IST day for today and yesterday', () => {
    expect(earningsPeriodContextLabel('today', asOf)).toBe('29 Oct');
    expect(earningsPeriodContextLabel('yesterday', asOf)).toBe('28 Oct');
  });

  it('shows IST month year for month periods', () => {
    expect(earningsPeriodContextLabel('thisMonth', asOf)).toBe('October 2026');
    expect(earningsPeriodContextLabel('lastMonth', asOf)).toBe('September 2026');
  });

  it('returns null for all time', () => {
    expect(earningsPeriodContextLabel('allTime', asOf)).toBeNull();
  });
});
