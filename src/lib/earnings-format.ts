import type { EarningsPeriodKey } from '@/lib/earnings-api';

const IST = 'Asia/Kolkata';

type IstDateParts = { year: number; month: number; day: number };

function istDateParts(date: Date): IstDateParts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);

  let year = 0;
  let month = 0;
  let day = 0;
  for (const part of parts) {
    if (part.type === 'year') year = Number(part.value);
    if (part.type === 'month') month = Number(part.value);
    if (part.type === 'day') day = Number(part.value);
  }
  return { year, month, day };
}

function dateFromIstParts(parts: IstDateParts): Date {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0));
}

function shiftIstCalendarDay(parts: IstDateParts, deltaDays: number): Date {
  const base = dateFromIstParts(parts);
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return base;
}

function shiftIstCalendarMonth(parts: IstDateParts, deltaMonths: number): Date {
  return new Date(Date.UTC(parts.year, parts.month - 1 + deltaMonths, 1, 12, 0, 0));
}

function formatIstDayMonth(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST,
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function formatIstMonthYear(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST,
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/** Context line under "Net earned" for the selected period (IST, not device TZ). */
export function earningsPeriodContextLabel(
  period: EarningsPeriodKey,
  asOf: Date | null,
): string | null {
  if (period === 'allTime') return null;

  const ref = asOf ?? new Date();
  const ist = istDateParts(ref);

  if (period === 'today') {
    return formatIstDayMonth(ref);
  }
  if (period === 'yesterday') {
    return formatIstDayMonth(shiftIstCalendarDay(ist, -1));
  }
  if (period === 'thisMonth') {
    return formatIstMonthYear(dateFromIstParts({ year: ist.year, month: ist.month, day: 1 }));
  }
  if (period === 'lastMonth') {
    return formatIstMonthYear(shiftIstCalendarMonth(ist, -1));
  }
  return null;
}

export function formatRefundedDisplay(refunded: number, formatInr: (amount: number) => string): string {
  if (refunded === 0) {
    return formatInr(0);
  }
  return `− ${formatInr(Math.abs(refunded))}`;
}
