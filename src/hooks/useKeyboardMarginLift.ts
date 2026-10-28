import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { LayoutChangeEvent, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { useKeyboardInset } from '@/hooks/useKeyboardInset';

/**
 * marginBottom lift for a fixed footer (location picker bar, modal sheets).
 */
export function useKeyboardMarginLift(measureRef: RefObject<View | null>) {
  const { height: keyboardHeight, screenY: keyboardScreenY } = useKeyboardInset();
  const keyboardVisible = keyboardScreenY > 0 && keyboardHeight > 0;
  const [lift, setLift] = useState(0);
  const liftRef = useRef(0);
  const appliedLift = keyboardVisible ? lift : 0;
  liftRef.current = appliedLift;

  const measureInWindow = useCallback(() => {
    measureRef.current?.measureInWindow((_x, y, _w, height) => {
      if (!keyboardVisible) return;
      if (height <= 0) return;
      const currentLift = liftRef.current;
      const overlap = Math.max(0, y + height + currentLift - keyboardScreenY);
      setLift(overlap > 0 ? overlap + spacing.sm : 0);
    });
  }, [keyboardVisible, keyboardScreenY, measureRef]);

  const onLayout = useCallback(
    (_event: LayoutChangeEvent) => {
      measureInWindow();
    },
    [measureInWindow],
  );

  useLayoutEffect(() => {
    if (keyboardVisible) {
      measureInWindow();
    } else {
      setLift(0);
    }
  }, [keyboardVisible, keyboardScreenY, keyboardHeight, measureInWindow]);

  return { appliedLift, onLayout };
}
