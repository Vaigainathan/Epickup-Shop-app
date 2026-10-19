import { describe, expect, it } from '@jest/globals';

import { priceOverridePlaceholder } from '@/lib/catalogue-format';

describe('priceOverridePlaceholder', () => {
  it('includes formatted base price', () => {
    expect(priceOverridePlaceholder(199)).toContain('Leave blank to use');
    expect(priceOverridePlaceholder(199)).toContain('199');
  });

  it('handles null base price', () => {
    expect(priceOverridePlaceholder(null)).toBe('Leave blank to use product price');
  });
});
