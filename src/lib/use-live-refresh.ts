import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

import {
  bindLiveRefreshScope,
  type LiveRefreshProfile,
  type LiveRefreshScope,
  setLiveRefreshFocused,
} from '@/lib/live-refresh';

type Options = {
  scope: LiveRefreshScope;
  refresh: () => Promise<void>;
  profile?: LiveRefreshProfile;
};

export function useLiveRefresh({ scope, refresh, profile }: Options): void {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useFocusEffect(
    useCallback(() => {
      const unbind = bindLiveRefreshScope(
        scope,
        () => refreshRef.current(),
        profile,
      );
      setLiveRefreshFocused(scope, true);
      return () => {
        unbind();
      };
    }, [scope, profile]),
  );
}
