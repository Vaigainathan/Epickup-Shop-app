import { describe, expect, it } from '@jest/globals';

import {
  copyDayToAllDays,
  emptyWeekDraft,
  EQUAL_TIMES_ERROR,
  isDayDraftConfigured,
  isOvernightOpenClose,
  isWeekDraftComplete,
  validateOpenCloseTimes,
  weekDraftFromApi,
  weekDraftToApi,
} from '@/lib/opening-hours';

describe('opening-hours', () => {
  it('starts with unset week', () => {
    const week = emptyWeekDraft();
    expect(isWeekDraftComplete(week)).toBe(false);
    expect(isDayDraftConfigured(week.monday)).toBe(false);
  });

  it('rejects equal open and close', () => {
    expect(validateOpenCloseTimes('09:00', '09:00')).toBe(EQUAL_TIMES_ERROR);
  });

  it('allows overnight', () => {
    expect(validateOpenCloseTimes('22:00', '02:00')).toBeNull();
    expect(isOvernightOpenClose('22:00', '02:00')).toBe(true);
  });

  it('converts complete draft to API week', () => {
    let week = emptyWeekDraft();
    week = copyDayToAllDays(
      {
        ...week,
        monday: { state: 'open', open: '09:00', close: '21:00' },
      },
      'monday',
    );
    week.sunday = { state: 'closed' };
    expect(isWeekDraftComplete(week)).toBe(true);
    const api = weekDraftToApi(week);
    expect(api?.monday).toEqual({ open: '09:00', close: '21:00' });
    expect(api?.sunday).toEqual({ closed: true });
  });

  it('loads API hours into draft', () => {
    const draft = weekDraftFromApi({
      monday: { open: '10:00', close: '20:00' },
      tuesday: { closed: true },
      wednesday: { open: '09:00', close: '18:00' },
      thursday: { open: '09:00', close: '18:00' },
      friday: { open: '09:00', close: '18:00' },
      saturday: { open: '09:00', close: '18:00' },
      sunday: { closed: true },
    });
    expect(draft.monday).toEqual({ state: 'open', open: '10:00', close: '20:00' });
    expect(draft.tuesday).toEqual({ state: 'closed' });
  });
});
