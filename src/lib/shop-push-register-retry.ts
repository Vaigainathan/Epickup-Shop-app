export type RetryOptions = {
  attempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

const DEFAULT_RETRY: RetryOptions = {
  attempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 4000,
};

export function devPushLog(message: string, detail?: unknown): void {
  if (!__DEV__) return;
  if (detail !== undefined) {
    console.warn(`[shop-push] ${message}`, detail);
  } else {
    console.warn(`[shop-push] ${message}`);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function withRetries<T>(
  label: string,
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const { attempts, baseDelayMs, maxDelayMs } = { ...DEFAULT_RETRY, ...options };
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) break;
      const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      devPushLog(`${label} failed (attempt ${attempt}/${attempts}), retry in ${backoff}ms`, error);
      await delay(backoff);
    }
  }

  devPushLog(`${label} failed after ${attempts} attempts`, lastError);
  throw lastError;
}
