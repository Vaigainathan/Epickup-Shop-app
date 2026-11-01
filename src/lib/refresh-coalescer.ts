type CoalescerState = {
  inFlight: Promise<void> | null;
  pending: boolean;
};

const coalescers = new Map<string, CoalescerState>();

function getState(key: string): CoalescerState {
  let state = coalescers.get(key);
  if (!state) {
    state = { inFlight: null, pending: false };
    coalescers.set(key, state);
  }
  return state;
}

export async function runCoalescedRefresh(key: string, run: () => Promise<void>): Promise<void> {
  const state = getState(key);
  if (state.inFlight) {
    state.pending = true;
    return state.inFlight;
  }

  state.inFlight = (async () => {
    try {
      do {
        state.pending = false;
        await run();
      } while (state.pending);
    } finally {
      state.inFlight = null;
    }
  })();

  return state.inFlight;
}

/** @internal test helper */
export function resetCoalescerForTests(key?: string): void {
  if (key) {
    coalescers.delete(key);
    return;
  }
  coalescers.clear();
}
