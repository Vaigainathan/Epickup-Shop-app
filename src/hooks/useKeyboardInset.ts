import { useEffect, useState } from 'react';
import { Keyboard, Platform, type KeyboardEvent } from 'react-native';

export type KeyboardInset = {
  height: number;
  /** Top edge of the keyboard in window coordinates; 0 when hidden. */
  screenY: number;
};

const HIDDEN: KeyboardInset = { height: 0, screenY: 0 };

export function useKeyboardInset(): KeyboardInset {
  const [inset, setInset] = useState<KeyboardInset>(HIDDEN);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (event: KeyboardEvent) => {
      setInset({
        height: event.endCoordinates.height,
        screenY: event.endCoordinates.screenY,
      });
    };

    const onHide = () => setInset(HIDDEN);

    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  return inset;
}
