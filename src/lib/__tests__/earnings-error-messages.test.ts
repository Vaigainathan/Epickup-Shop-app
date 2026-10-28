import { describe, expect, it } from '@jest/globals';

import { GENERIC_API_ERROR, SESSION_EXPIRED_COPY } from '@/lib/api-error-messages';
import { DashboardApiError } from '@/lib/dashboard-api';
import { earningsErrorMessage } from '@/lib/earnings-error-messages';

describe('earningsErrorMessage', () => {
  it('never returns raw server message', () => {
    const err = new DashboardApiError('raw server text', 500, 'INTERNAL_ERROR');
    const msg = earningsErrorMessage(err, "Couldn't load earnings.");
    expect(msg).toBe(GENERIC_API_ERROR);
    expect(msg).not.toContain('raw server');
  });

  it('maps UNAUTHENTICATED to session copy', () => {
    const err = new DashboardApiError('', 401, 'UNAUTHENTICATED');
    expect(earningsErrorMessage(err, "Couldn't load earnings.")).toBe(SESSION_EXPIRED_COPY);
  });

  it('returns fallback for non-DashboardApiError', () => {
    expect(earningsErrorMessage(new Error('x'), "Couldn't load earnings.")).toBe(
      "Couldn't load earnings.",
    );
  });
});
