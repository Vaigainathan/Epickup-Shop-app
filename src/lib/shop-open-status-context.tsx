import { useSegments } from 'expo-router';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { fetchShopProfile } from '@/lib/dashboard-api';
import type { ShopOpenIndicatorInput } from '@/lib/shop-open-indicator';

type ShopOpenStatus = ShopOpenIndicatorInput;

type ShopOpenStatusContextValue = {
  status: ShopOpenStatus;
  refresh: () => Promise<void>;
  patchStatus: (patch: Partial<ShopOpenStatus>) => void;
};

const defaultStatus: ShopOpenStatus = {
  isOpen: false,
  isOpenNow: false,
  opensAt: null,
  closesAt: null,
};

const ShopOpenStatusContext = createContext<ShopOpenStatusContextValue | null>(null);

export function useShopOpenStatus(): ShopOpenStatusContextValue {
  const value = useContext(ShopOpenStatusContext);
  if (!value) {
    throw new Error('useShopOpenStatus must be used within ShopOpenStatusProvider');
  }
  return value;
}

export function useShowShopTabHeader(): boolean {
  const segments = useSegments();
  const tab = segments[1];
  if (segments.length !== 2) return false;
  return (
    tab === '(dashboard)' ||
    tab === '(catalogue)' ||
    tab === '(orders)' ||
    tab === '(settings)'
  );
}

export function ShopOpenStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ShopOpenStatus>(defaultStatus);
  const segments = useSegments();
  const segmentKey = segments.join('/');

  const refresh = useCallback(async () => {
    try {
      const profile = await fetchShopProfile();
      setStatus({
        isOpen: profile.isOpen,
        isOpenNow: profile.isOpenNow,
        opensAt: profile.opensAt,
        closesAt: profile.closesAt,
      });
    } catch {
      // keep last known status
    }
  }, []);

  const patchStatus = useCallback((patch: Partial<ShopOpenStatus>) => {
    setStatus((current) => ({ ...current, ...patch }));
  }, []);

  useEffect(() => {
    void refresh();
  }, [segmentKey, refresh]);

  const value = useMemo(
    () => ({ status, refresh, patchStatus }),
    [status, refresh, patchStatus],
  );

  return <ShopOpenStatusContext.Provider value={value}>{children}</ShopOpenStatusContext.Provider>;
}
