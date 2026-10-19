export const WEEKDAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

export type DayHoursClosed = { closed: true };
export type DayHoursOpen = { open: string; close: string };
export type DayHours = DayHoursClosed | DayHoursOpen;

export type OpeningHoursWeek = Record<WeekdayKey, DayHours>;

export type DayDraft =
  | { state: 'unset' }
  | { state: 'closed' }
  | { state: 'open'; open: string; close: string };

export type WeekDraft = Record<WeekdayKey, DayDraft>;

export const EQUAL_TIMES_ERROR = "Opening and closing time can't be the same";

export function emptyWeekDraft(): WeekDraft {
  return {
    monday: { state: 'unset' },
    tuesday: { state: 'unset' },
    wednesday: { state: 'unset' },
    thursday: { state: 'unset' },
    friday: { state: 'unset' },
    saturday: { state: 'unset' },
    sunday: { state: 'unset' },
  };
}

export function weekDraftFromApi(hours: OpeningHoursWeek | null | undefined): WeekDraft {
  if (!hours) return emptyWeekDraft();
  const draft = emptyWeekDraft();
  for (const key of WEEKDAY_KEYS) {
    const day = hours[key];
    if (!day) {
      draft[key] = { state: 'unset' };
      continue;
    }
    if ('closed' in day && day.closed) {
      draft[key] = { state: 'closed' };
      continue;
    }
    if ('open' in day && 'close' in day && day.open && day.close) {
      draft[key] = { state: 'open', open: day.open, close: day.close };
      continue;
    }
    draft[key] = { state: 'unset' };
  }
  return draft;
}

export function isOvernightOpenClose(open: string, close: string): boolean {
  return close < open;
}

export function validateOpenCloseTimes(open: string, close: string): string | null {
  if (!/^\d{2}:\d{2}$/.test(open) || !/^\d{2}:\d{2}$/.test(close)) {
    return 'Enter valid opening and closing times.';
  }
  if (open === close) return EQUAL_TIMES_ERROR;
  return null;
}

export function validateDayDraft(day: DayDraft): string | null {
  if (day.state === 'unset') return 'Set hours or mark this day closed.';
  if (day.state === 'closed') return null;
  return validateOpenCloseTimes(day.open, day.close);
}

export function isDayDraftConfigured(day: DayDraft): boolean {
  return day.state !== 'unset';
}

export function isWeekDraftComplete(week: WeekDraft): boolean {
  return WEEKDAY_KEYS.every((key) => validateDayDraft(week[key]) === null);
}

export function weekDraftToApi(week: WeekDraft): OpeningHoursWeek | null {
  if (!isWeekDraftComplete(week)) return null;
  const out = {} as OpeningHoursWeek;
  for (const key of WEEKDAY_KEYS) {
    const day = week[key];
    if (day.state === 'closed') {
      out[key] = { closed: true };
    } else if (day.state === 'open') {
      out[key] = { open: day.open, close: day.close };
    } else {
      return null;
    }
  }
  return out;
}

export function copyDayToAllDays(week: WeekDraft, source: WeekdayKey): WeekDraft {
  const template = week[source];
  const next = { ...week };
  for (const key of WEEKDAY_KEYS) {
    next[key] = { ...template };
  }
  return next;
}

export function formatHm12(hm: string): string {
  const [hStr, mStr] = hm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hm;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

export const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};
