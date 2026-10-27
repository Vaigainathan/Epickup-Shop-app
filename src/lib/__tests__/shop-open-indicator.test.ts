import { describe, expect, it } from '@jest/globals';

import { formatOpensAtLabel, formatShopOpenIndicator } from '@/lib/shop-open-indicator';
import { shopOpenChipVariant } from '@/lib/shop-open-chip';
import { formatIstTime } from '@/lib/shop-order-types';

describe('shopOpenChipVariant', () => {
  it('returns manuallyClosed when toggle off', () => {
    expect(
      shopOpenChipVariant({
        isOpen: false,
        isOpenNow: false,
        opensAt: null,
        closesAt: null,
      }),
    ).toBe('manuallyClosed');
  });

  it('returns openNow when open and within hours', () => {
    expect(
      shopOpenChipVariant({
        isOpen: true,
        isOpenNow: true,
        opensAt: null,
        closesAt: null,
      }),
    ).toBe('openNow');
  });

  it('returns outsideHours when open but not open now', () => {
    expect(
      shopOpenChipVariant({
        isOpen: true,
        isOpenNow: false,
        opensAt: new Date('2026-01-15T14:00:00+05:30'),
        closesAt: null,
      }),
    ).toBe('outsideHours');
  });
});

describe('formatShopOpenIndicator', () => {
  it('shows closed when toggle off', () => {
    expect(
      formatShopOpenIndicator({
        isOpen: false,
        isOpenNow: false,
        opensAt: null,
        closesAt: null,
      }),
    ).toBe('Closed');
  });

  it('shows open with close time', () => {
    const closesAt = new Date('2026-01-15T16:30:00+05:30');
    const text = formatShopOpenIndicator({
      isOpen: true,
      isOpenNow: true,
      opensAt: null,
      closesAt,
      now: new Date('2026-01-15T12:00:00+05:30'),
    });
    expect(text).toMatch(/^Open · closes /);
  });
});

describe('formatIstTime', () => {
  it('formats midnight and noon with uppercase AM/PM', () => {
    expect(formatIstTime(new Date('2026-01-15T00:00:00+05:30'))).toBe('12:00 AM');
    expect(formatIstTime(new Date('2026-01-15T12:30:00+05:30'))).toBe('12:30 PM');
    expect(formatIstTime(new Date('2026-01-15T09:05:00+05:30'))).toBe('9:05 AM');
  });
});

describe('formatOpensAtLabel', () => {
  const now = new Date('2026-01-15T10:00:00+05:30');

  it('uses today wording', () => {
    const opensAt = new Date('2026-01-15T14:00:00+05:30');
    expect(formatOpensAtLabel(opensAt, now)).toBe('Closed now · opens 2:00 PM');
  });

  it('uses tomorrow wording', () => {
    const opensAt = new Date('2026-01-16T09:00:00+05:30');
    expect(formatOpensAtLabel(opensAt, now)).toBe('Closed now · opens tomorrow 9:00 AM');
  });

  it('uses weekday for later days', () => {
    const opensAt = new Date('2026-01-20T09:00:00+05:30');
    const label = formatOpensAtLabel(opensAt, now);
    expect(label).toMatch(/^Closed now · opens /);
    expect(label).toContain('9:00 AM');
  });
});
