import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  ScrollView,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '@/constants/theme';
import { useKeyboardInset } from '@/hooks/useKeyboardInset';

const MIN_SCROLL_HEIGHT = 120;

type Props = {
  basePaddingBottom: number;
  cardPaddingTop: number;
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

/**
 * Lifts the sheet with marginBottom from measured keyboard overlap (not content padding).
 */
export function KeyboardInsetSheetScroll({
  basePaddingBottom,
  cardPaddingTop,
  children,
  contentContainerStyle,
}: Props) {
  const safeTop = useSafeAreaInsets().top;
  const { height: keyboardHeight, screenY: keyboardScreenY } = useKeyboardInset();

  const keyboardVisible = keyboardScreenY > 0 && keyboardHeight > 0;

  const measureRef = useRef<View>(null);
  const [lift, setLift] = useState(0);
  const liftRef = useRef(0);

  const appliedLift = keyboardVisible ? lift : 0;
  liftRef.current = appliedLift;

  const applyMeasure = useCallback(
    (y: number, height: number) => {
      if (!keyboardVisible) return;
      if (height <= 0) return;
      const rawBottom = y + height;
      const overlap = Math.max(0, rawBottom - keyboardScreenY);

      if (overlap > 0) {
        setLift(overlap + spacing.sm);
        return;
      }

      if (liftRef.current > 0 && rawBottom <= keyboardScreenY) {
        return;
      }

      setLift(0);
    },
    [keyboardScreenY, keyboardVisible],
  );

  const measureInWindow = useCallback(() => {
    measureRef.current?.measureInWindow((_x, y, _w, height) => {
      applyMeasure(y, height);
    });
  }, [applyMeasure]);

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

  const keyboardCoversSheet = appliedLift > 0;

  const scrollMaxHeight = keyboardCoversSheet
    ? Math.max(
        MIN_SCROLL_HEIGHT,
        keyboardScreenY - spacing.sm - safeTop - cardPaddingTop - spacing.lg,
      )
    : undefined;

  const scrollEnabled = keyboardCoversSheet;

  return (
    <View
      ref={measureRef}
      testID="keyboard-inset-sheet-scroll"
      onLayout={onLayout}
      style={{ marginBottom: appliedLift }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        scrollEnabled={scrollEnabled}
        style={scrollMaxHeight !== undefined ? { maxHeight: scrollMaxHeight } : undefined}
        contentContainerStyle={[contentContainerStyle, { paddingBottom: basePaddingBottom }]}
        showsVerticalScrollIndicator={keyboardCoversSheet}>
        {children}
      </ScrollView>
    </View>
  );
}
