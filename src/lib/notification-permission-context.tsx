import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState } from 'react-native';

import {
  probeNotificationPermissionForBanner,
  shouldShowNotificationsOffBanner,
  type NotificationPermissionBannerState,
} from '@/lib/notification-permission';

type ContextValue = {
  bannerState: NotificationPermissionBannerState;
  showBanner: boolean;
  recheck: () => Promise<void>;
};

const NotificationPermissionContext = createContext<ContextValue | null>(null);

export function NotificationPermissionProvider({ children }: { children: ReactNode }) {
  const [bannerState, setBannerState] = useState<NotificationPermissionBannerState>('granted');

  const recheck = useCallback(async () => {
    const next = await probeNotificationPermissionForBanner();
    setBannerState(next);
  }, []);

  useEffect(() => {
    void recheck();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void recheck();
    });
    return () => sub.remove();
  }, [recheck]);

  const value = useMemo(
    () => ({
      bannerState,
      showBanner: shouldShowNotificationsOffBanner(bannerState),
      recheck,
    }),
    [bannerState, recheck],
  );

  return (
    <NotificationPermissionContext.Provider value={value}>
      {children}
    </NotificationPermissionContext.Provider>
  );
}

export function useNotificationPermissionBanner(): ContextValue {
  const ctx = useContext(NotificationPermissionContext);
  if (!ctx) {
    throw new Error('useNotificationPermissionBanner must be used within NotificationPermissionProvider');
  }
  return ctx;
}
