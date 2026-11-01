import { AppState, type AppStateStatus } from 'react-native';

import { runCoalescedRefresh } from '@/lib/refresh-coalescer';

export type LiveRefreshScope = 'orders' | 'dashboard';

export type LiveRefreshProfile = {
  minIntervalMs: number;
  maxIntervalMs: number;
  maxBackoffMs: number;
};

export const ORDERS_LIVE_REFRESH_PROFILE: LiveRefreshProfile = {
  minIntervalMs: 15_000,
  maxIntervalMs: 20_000,
  maxBackoffMs: 120_000,
};

export const DASHBOARD_LIVE_REFRESH_PROFILE: LiveRefreshProfile = {
  minIntervalMs: 28_000,
  maxIntervalMs: 32_000,
  maxBackoffMs: 120_000,
};

type ScopeEntry = {
  handler: (() => Promise<void>) | null;
  profile: LiveRefreshProfile;
  timer: ReturnType<typeof setTimeout> | null;
  backoffMs: number;
  focused: boolean;
};

const scopes = new Map<LiveRefreshScope, ScopeEntry>();

let appStateListenerAttached = false;
let appState: AppStateStatus = AppState.currentState;

function jitterDelay(profile: LiveRefreshProfile, backoffMs: number): number {
  const base =
    profile.minIntervalMs + Math.random() * (profile.maxIntervalMs - profile.minIntervalMs);
  return Math.max(base, backoffMs);
}

function isRefreshFailure(error: unknown): boolean {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = Number((error as { status: number }).status);
    if (status === 0 || status === 429) return true;
    if (status >= 500) return true;
    return false;
  }
  return true;
}

function getScope(scope: LiveRefreshScope): ScopeEntry {
  let entry = scopes.get(scope);
  if (!entry) {
    entry = {
      handler: null,
      profile: scope === 'dashboard' ? DASHBOARD_LIVE_REFRESH_PROFILE : ORDERS_LIVE_REFRESH_PROFILE,
      timer: null,
      backoffMs: 0,
      focused: false,
    };
    scopes.set(scope, entry);
  }
  return entry;
}

function clearScopeTimer(entry: ScopeEntry): void {
  if (entry.timer) {
    clearTimeout(entry.timer);
    entry.timer = null;
  }
}

function scheduleScopeTimer(scope: LiveRefreshScope): void {
  const entry = getScope(scope);
  clearScopeTimer(entry);
  if (!entry.focused || !entry.handler || appState !== 'active') return;

  const delayMs = jitterDelay(entry.profile, entry.backoffMs);
  entry.timer = setTimeout(() => {
    void triggerLiveRefresh(scope).finally(() => scheduleScopeTimer(scope));
  }, delayMs);
}

export function triggerLiveRefresh(scope: LiveRefreshScope): Promise<void> {
  const entry = getScope(scope);
  const handler = entry.handler;
  if (!handler) return Promise.resolve();

  return runCoalescedRefresh(scope, async () => {
    try {
      await handler();
      entry.backoffMs = 0;
    } catch (error) {
      if (isRefreshFailure(error)) {
        const next = entry.backoffMs > 0 ? entry.backoffMs * 2 : entry.profile.minIntervalMs;
        entry.backoffMs = Math.min(entry.profile.maxBackoffMs, next);
      }
      throw error;
    }
  }).catch(() => {
    // Swallow — screens surface errors via their own load paths when needed.
  });
}

export function setLiveRefreshHandler(
  scope: LiveRefreshScope,
  handler: (() => Promise<void>) | null,
  profile?: LiveRefreshProfile,
): void {
  const entry = getScope(scope);
  entry.handler = handler;
  if (profile) entry.profile = profile;
}

export function setLiveRefreshFocused(scope: LiveRefreshScope, focused: boolean): void {
  const entry = getScope(scope);
  entry.focused = focused;
  if (!focused) {
    clearScopeTimer(entry);
    entry.backoffMs = 0;
    return;
  }
  if (appState === 'active' && entry.handler) {
    scheduleScopeTimer(scope);
  }
}

function onAppStateChange(next: AppStateStatus): void {
  appState = next;
  if (next === 'active') {
    for (const scope of scopes.keys()) {
      const entry = getScope(scope);
      if (entry.focused && entry.handler) {
        void triggerLiveRefresh(scope);
        scheduleScopeTimer(scope);
      }
    }
    return;
  }

  for (const scope of scopes.keys()) {
    clearScopeTimer(getScope(scope));
  }
}

function ensureAppStateListener(): void {
  if (appStateListenerAttached) return;
  appStateListenerAttached = true;
  appState = AppState.currentState;
  AppState.addEventListener('change', onAppStateChange);
}

export function bindLiveRefreshScope(
  scope: LiveRefreshScope,
  handler: () => Promise<void>,
  profile?: LiveRefreshProfile,
): () => void {
  ensureAppStateListener();
  setLiveRefreshHandler(scope, handler, profile);
  return () => {
    setLiveRefreshFocused(scope, false);
    setLiveRefreshHandler(scope, null);
  };
}

/** @internal test helper */
export function resetLiveRefreshForTests(): void {
  for (const scope of [...scopes.keys()]) {
    const entry = getScope(scope);
    clearScopeTimer(entry);
    entry.handler = null;
    entry.focused = false;
    entry.backoffMs = 0;
  }
}
