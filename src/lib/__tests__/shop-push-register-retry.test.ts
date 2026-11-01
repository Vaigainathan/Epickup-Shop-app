import { describe, expect, it, jest } from '@jest/globals';

import { withRetries } from '@/lib/shop-push-register-retry';

describe('withRetries', () => {
  it('retries until success', async () => {
    let calls = 0;
    const result = await withRetries('test', async () => {
      calls += 1;
      if (calls < 3) throw new Error('fail');
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  it('throws after attempts exhausted', async () => {
    await expect(
      withRetries('test', async () => {
        throw new Error('always');
      }),
    ).rejects.toThrow('always');
  });
});
