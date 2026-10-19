import { describe, expect, it } from '@jest/globals';

import { validateUpiRegisteredName } from '@/lib/upi-registered-name';

describe('validateUpiRegisteredName', () => {
  it('accepts trimmed name in range', () => {
    expect(validateUpiRegisteredName('  Shop Owner  ')).toEqual({
      ok: true,
      value: 'Shop Owner',
    });
  });

  it('rejects empty', () => {
    expect(validateUpiRegisteredName('   ').ok).toBe(false);
  });

  it('rejects over 100 chars', () => {
    expect(validateUpiRegisteredName('a'.repeat(101)).ok).toBe(false);
  });
});
