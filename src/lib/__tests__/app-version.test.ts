import { beforeEach, describe, expect, it, jest } from '@jest/globals';

let mockExpoConfig: { version?: string } | undefined = { version: '2.4.0' };

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return mockExpoConfig;
    },
  },
}));

import { getAppVersionLabel } from '@/lib/app-version';

describe('getAppVersionLabel', () => {
  beforeEach(() => {
    mockExpoConfig = { version: '2.4.0' };
  });

  it('prefixes expo config version with v', () => {
    expect(getAppVersionLabel()).toBe('v2.4.0');
  });

  it('returns empty string when version is missing', () => {
    mockExpoConfig = {};
    expect(getAppVersionLabel()).toBe('');
  });

  it('returns empty string when expoConfig is missing', () => {
    mockExpoConfig = undefined;
    expect(getAppVersionLabel()).toBe('');
  });
});