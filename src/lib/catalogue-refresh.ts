type Listener = () => void;

const listeners = new Set<Listener>();

export function subscribeCatalogueRefresh(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function requestCatalogueRefresh(): void {
  listeners.forEach((listener) => listener());
}
