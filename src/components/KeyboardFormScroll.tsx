import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
} from 'react';
import {
  ScrollView,
  TextInput,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from 'react-native';

import { spacing } from '@/constants/theme';
import { useKeyboardInset } from '@/hooks/useKeyboardInset';
import { basePaddingBottomFromContentStyle } from '@/lib/keyboard-scroll-padding';

export type KeyboardFormScrollContextValue = {
  registerFocused: (ref: TextInput | null) => void;
  unregisterFocused: (ref: TextInput | null) => void;
};

export const KeyboardFormScrollContext = createContext<KeyboardFormScrollContextValue | null>(
  null,
);

export function useKeyboardFormScrollContext(): KeyboardFormScrollContextValue | null {
  return useContext(KeyboardFormScrollContext);
}

function mergeRefs<T>(...refs: Array<Ref<T> | undefined>) {
  return (value: T | null) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === 'function') ref(value);
      else ref.current = value;
    }
  };
}

export const KeyboardFormScroll = forwardRef<ScrollView, ScrollViewProps>(function KeyboardFormScroll(
  { contentContainerStyle, onScroll, onLayout, style, children, ...rest },
  ref,
) {
  const { height: keyboardHeight, screenY: keyboardScreenY } = useKeyboardInset();
  const keyboardVisible = keyboardScreenY > 0 && keyboardHeight > 0;

  const measureRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  const focusedRef = useRef<TextInput | null>(null);
  const scrollFocusedIntoViewRef = useRef<() => void>(() => {});
  const [extraBottom, setExtraBottom] = useState(0);

  const basePaddingBottom = useMemo(
    () => basePaddingBottomFromContentStyle(contentContainerStyle),
    [contentContainerStyle],
  );

  const contextValue = useMemo<KeyboardFormScrollContextValue>(
    () => ({
      registerFocused: (input) => {
        focusedRef.current = input;
        scrollFocusedIntoViewRef.current();
      },
      unregisterFocused: (input) => {
        if (focusedRef.current === input) {
          focusedRef.current = null;
        }
      },
    }),
    [],
  );

  const measureViewport = useCallback(() => {
    measureRef.current?.measureInWindow((_x, y, _w, height) => {
      if (!keyboardVisible) {
        setExtraBottom(0);
        return;
      }
      if (height <= 0) return;
      const overlap = Math.max(0, y + height - keyboardScreenY);
      setExtraBottom(overlap > 0 ? overlap + spacing.lg : 0);
    });
  }, [keyboardVisible, keyboardScreenY]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      onLayout?.(event);
      measureViewport();
    },
    [measureViewport, onLayout],
  );

  useLayoutEffect(() => {
    if (keyboardVisible) {
      measureViewport();
    } else {
      setExtraBottom(0);
    }
  }, [keyboardVisible, keyboardScreenY, keyboardHeight, measureViewport]);

  const scrollFocusedIntoView = useCallback(() => {
    const input = focusedRef.current;
    if (!keyboardVisible || !input || extraBottom <= 0) return;

    input.measureInWindow((_x, inputY, _w, inputHeight) => {
      const delta = inputY + inputHeight + spacing.lg - keyboardScreenY;
      if (delta > 0) {
        scrollRef.current?.scrollTo({
          y: scrollOffsetRef.current + delta,
          animated: true,
        });
      }
    });
  }, [keyboardVisible, keyboardScreenY, extraBottom]);

  scrollFocusedIntoViewRef.current = scrollFocusedIntoView;

  useLayoutEffect(() => {
    if (keyboardVisible && extraBottom > 0) {
      scrollFocusedIntoView();
    }
  }, [keyboardVisible, keyboardScreenY, keyboardHeight, extraBottom, scrollFocusedIntoView]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
      onScroll?.(event);
    },
    [onScroll],
  );

  const resolvedContentContainerStyle =
    keyboardVisible && extraBottom > 0
      ? [contentContainerStyle, { paddingBottom: basePaddingBottom + extraBottom }]
      : contentContainerStyle;

  return (
    <KeyboardFormScrollContext.Provider value={contextValue}>
      <View ref={measureRef} onLayout={handleLayout} style={{ flex: 1 }}>
        <ScrollView
          ref={mergeRefs(ref, scrollRef)}
          style={style}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={handleScroll}
          contentContainerStyle={resolvedContentContainerStyle}
          {...rest}>
          {children}
        </ScrollView>
      </View>
    </KeyboardFormScrollContext.Provider>
  );
});
