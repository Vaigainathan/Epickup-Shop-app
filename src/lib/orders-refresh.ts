type RefreshListener = () => void;

const listeners = new Set<RefreshListener>();

export function subscribeOrdersRefresh(listener: RefreshListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function requestOrdersRefresh(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // ignore subscriber errors
    }
  }
}
