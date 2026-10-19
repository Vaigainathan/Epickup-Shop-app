import { describe, expect, it } from '@jest/globals';

import { GENERIC_API_ERROR, mapApiErrorCode, SESSION_EXPIRED_COPY } from '@/lib/api-error-messages';
import { authErrorMessage } from '@/lib/auth-error-messages';
import { AuthApiError } from '@/lib/auth-api';
import { catalogueErrorMessage } from '@/lib/catalogue-error-messages';
import { CatalogueApiError } from '@/lib/catalogue-api';
import { dashboardErrorMessage } from '@/lib/dashboard-error-messages';
import { DashboardApiError } from '@/lib/dashboard-api';

describe('mapApiErrorCode', () => {
  it('returns default for unknown codes', () => {
    expect(mapApiErrorCode({ status: 400, code: 'SOME_NEW_CODE' }, {}, GENERIC_API_ERROR)).toBe(
      GENERIC_API_ERROR,
    );
  });

  it('never returns server message from error object', () => {
    const err = new DashboardApiError('raw server text', 500, 'INTERNAL_ERROR');
    expect(dashboardErrorMessage(err, 'fallback')).toBe(GENERIC_API_ERROR);
    expect(dashboardErrorMessage(err, 'fallback')).not.toContain('raw server');
  });

  it('maps UNAUTHENTICATED to session copy', () => {
    expect(
      mapApiErrorCode({ status: 401, code: 'UNAUTHENTICATED' }, {}, GENERIC_API_ERROR),
    ).toBe(SESSION_EXPIRED_COPY);
    expect(dashboardErrorMessage(new DashboardApiError('', 401, 'UNAUTHENTICATED'), 'x')).toBe(
      SESSION_EXPIRED_COPY,
    );
  });
});

describe('catalogueErrorMessage', () => {
  it('maps CATEGORY_IN_USE', () => {
    const err = new CatalogueApiError('server', 409, 'CATEGORY_IN_USE');
    expect(catalogueErrorMessage(err, 'x')).toContain('category still has products');
  });
});

describe('authErrorMessage', () => {
  it('does not expose server message', () => {
    const err = new AuthApiError('secret', 400, 'WEAK_PASSWORD');
    const msg = authErrorMessage(err, 'fallback');
    expect(msg).not.toContain('secret');
    expect(msg).toContain('stronger password');
  });
});
