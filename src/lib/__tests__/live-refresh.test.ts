import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  bindLiveRefreshScope,
  resetLiveRefreshForTests,
  setLiveRefreshFocused,
  triggerLiveRefresh,
} from '@/lib/live-refresh';
import { resetCoalescerForTests } from '@/lib/refresh-coalescer';

describe('live-refresh', () => {
  beforeEach(() => {
    resetLiveRefreshForTests();
    resetCoalescerForTests();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('dedupes concurrent refresh calls', async () => {
    let calls = 0;
    const handler = jest.fn(async () => {
      calls += 1;
    });
    const unbind = bindLiveRefreshScope('orders', handler);
    setLiveRefreshFocused('orders', true);

    await Promise.all([triggerLiveRefresh('orders'), triggerLiveRefresh('orders')]);

    expect(calls).toBe(2);
    unbind();
  });

  it('stops scheduling when unfocused', () => {
    const handler = jest.fn(async () => {});
    bindLiveRefreshScope('orders', handler);
    setLiveRefreshFocused('orders', true);
    setLiveRefreshFocused('orders', false);
    jest.advanceTimersByTime(60_000);
    expect(handler).not.toHaveBeenCalled();
  });
});
