import { describe, expect, it } from '@jest/globals';

import {
  EARNINGS_PERIOD_KEYS,
  parseShopEarningsResponse,
  zeroEarningsPeriodStats,
} from '@/lib/earnings-api';

describe('parseShopEarningsResponse', () => {
  it('parses a full contract payload', () => {
    const asOf = '2026-10-29T12:00:00+05:30';
    const period = {
      received: 1000,
      refunded: 200,
      net: 800,
      paidOrders: 5,
      completedOrders: 4,
      cancelledOrders: 1,
      refundsSent: 2,
    };
    const body = {
      success: true,
      data: {
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        asOf,
        periods: {
          today: period,
          yesterday: period,
          thisMonth: period,
          lastMonth: period,
          allTime: period,
        },
        refundsDue: { count: 3, amount: 450 },
      },
    };

    const parsed = parseShopEarningsResponse(body);
    expect(parsed.currency).toBe('INR');
    expect(parsed.timezone).toBe('Asia/Kolkata');
    expect(parsed.asOf).toBeInstanceOf(Date);
    expect(parsed.periods.today.net).toBe(800);
    expect(parsed.refundsDue).toEqual({ count: 3, amount: 450 });
  });

  it('fills missing period fields with zeros', () => {
    const body = {
      data: {
        periods: {
          today: { received: 50 },
        },
      },
    };
    const parsed = parseShopEarningsResponse(body);
    expect(parsed.periods.today).toEqual({
      received: 50,
      refunded: 0,
      net: 0,
      paidOrders: 0,
      completedOrders: 0,
      cancelledOrders: 0,
      refundsSent: 0,
    });
    for (const key of EARNINGS_PERIOD_KEYS) {
      expect(parsed.periods[key]).toBeDefined();
    }
  });

  it('returns safe defaults for garbage input', () => {
    expect(parseShopEarningsResponse(null).currency).toBe('INR');
    expect(parseShopEarningsResponse(null).timezone).toBe('Asia/Kolkata');
    expect(parseShopEarningsResponse(null).asOf).toBeNull();
    expect(parseShopEarningsResponse(null).refundsDue).toEqual({ count: 0, amount: 0 });
    expect(parseShopEarningsResponse('bad').periods.today).toEqual(zeroEarningsPeriodStats());
  });
});
