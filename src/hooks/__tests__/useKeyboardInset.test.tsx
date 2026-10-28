import { beforeEach, afterEach, describe, expect, it, jest } from '@jest/globals';
import {
  Keyboard,
  Platform,
  Text,
  type EmitterSubscription,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { useKeyboardInset } from '@/hooks/useKeyboardInset';

type KeyboardListener = (event: {
  endCoordinates: { height: number; screenY: number };
}) => void;

const listeners: Record<string, KeyboardListener[]> = {};
const removeMocks: jest.Mock[] = [];

function showEventName() {
  return Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
}

function hideEventName() {
  return Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
}

function Probe() {
  const inset = useKeyboardInset();
  return (
    <Text testID="probe">
      {inset.height},{inset.screenY}
    </Text>
  );
}

function fireShow(height: number, screenY: number) {
  const event = showEventName();
  for (const cb of listeners[event] ?? []) {
    cb({ endCoordinates: { height, screenY } });
  }
}

function fireHide() {
  const event = hideEventName();
  for (const cb of listeners[event] ?? []) {
    cb({ endCoordinates: { height: 0, screenY: 0 } });
  }
}

function probeText(tree: renderer.ReactTestRenderer): string {
  const children = tree.root.findByProps({ testID: 'probe' }).props.children;
  if (Array.isArray(children)) return children.join('');
  return String(children);
}

describe('useKeyboardInset', () => {
  let addListenerSpy: jest.SpiedFunction<typeof Keyboard.addListener>;

  beforeEach(() => {
    for (const key of Object.keys(listeners)) {
      delete listeners[key];
    }
    removeMocks.length = 0;

    addListenerSpy = jest.spyOn(Keyboard, 'addListener').mockImplementation((event, callback) => {
      const name = event as string;
      listeners[name] = listeners[name] ?? [];
      listeners[name].push(callback as KeyboardListener);
      const remove = jest.fn();
      removeMocks.push(remove);
      return { remove } as unknown as EmitterSubscription;
    });
  });

  afterEach(() => {
    addListenerSpy.mockRestore();
  });

  it('returns height and screenY on show, zeros on hide', () => {
    let tree!: renderer.ReactTestRenderer;

    act(() => {
      tree = renderer.create(<Probe />);
    });

    act(() => {
      fireShow(280, 520);
    });

    expect(probeText(tree)).toBe('280,520');

    act(() => {
      fireHide();
    });

    expect(probeText(tree)).toBe('0,0');
  });

  it('removes keyboard listeners on unmount', () => {
    let tree!: renderer.ReactTestRenderer;

    act(() => {
      tree = renderer.create(<Probe />);
    });

    expect(removeMocks.length).toBeGreaterThanOrEqual(2);

    act(() => {
      tree.unmount();
    });

    for (const remove of removeMocks) {
      expect(remove).toHaveBeenCalled();
    }
  });
});
