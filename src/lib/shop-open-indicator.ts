import { formatIstTime } from '@/lib/shop-order-types';

export type ShopOpenIndicatorInput = {
  isOpen: boolean;
  isOpenNow: boolean;
  opensAt: Date | null;
  closesAt: Date | null;
  now?: Date;
};

const IST = 'Asia/Kolkata';

function istYmd(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function istWeekdayShort(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST,
    weekday: 'short',
  }).format(date);
}

/** e.g. opens 9:00 AM · opens tomorrow 9:00 AM · opens Mon 9:00 AM */
export function formatOpensAtLabel(opensAt: Date, now: Date = new Date()): string {
  const time = formatIstTime(opensAt);
  if (!time) return 'Closed now';
  const openDay = istYmd(opensAt);
  const today = istYmd(now);
  if (openDay === today) {
    return `Closed now · opens ${time}`;
  }
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (openDay === istYmd(tomorrow)) {
    return `Closed now · opens tomorrow ${time}`;
  }
  const day = istWeekdayShort(opensAt);
  return `Closed now · opens ${day} ${time}`;
}

export function formatShopOpenIndicator(input: ShopOpenIndicatorInput): string {
  const { isOpen, isOpenNow, opensAt, closesAt } = input;
  const now = input.now ?? new Date();

  if (!isOpen) return 'Closed';

  if (isOpenNow) {
    const close = formatIstTime(closesAt);
    return close ? `Open · closes ${close}` : 'Open';
  }

  if (opensAt) {
    return formatOpensAtLabel(opensAt, now);
  }

  return 'Closed now';
}
