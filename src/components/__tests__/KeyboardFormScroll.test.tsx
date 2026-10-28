import { beforeEach, afterEach, describe, expect, it, jest } from '@jest/globals';
import { TextInput, ScrollView, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { KeyboardFormScroll } from '@/components/KeyboardFormScroll';
import { AppTextInput } from '@/components/AppTextInput';
import { spacing } from '@/constants/theme';

const mockUseKeyboardInset = jest.fn<() => { height: number; screenY: number }>();

jest.mock('@/hooks/useKeyboardInset', () => ({
  useKeyboardInset: () => mockUseKeyboardInset(),
}));

const BASE_PADDING = spacing.section;

function flattenStyle(style: unknown): Record<string, unknown> {
  if (!style) return {};
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (acc, part) => ({ ...acc, ...flattenStyle(part) }),
      {},
    );
  }
  return style as Record<string, unknown>;
}

describe('KeyboardFormScroll', () => {
  let measureInWindowSpy: jest.SpiedFunction<View['measureInWindow']>;
  let scrollToSpy: jest.SpiedFunction<ScrollView['scrollTo']>;

  beforeEach(() => {
    mockUseKeyboardInset.mockReturnValue({ height: 0, screenY: 0 });
    measureInWindowSpy = jest
      .spyOn(View.prototype, 'measureInWindow')
      .mockImplementation(function (this: View, callback) {
        callback(0, 400, 400, 300);
      });
    scrollToSpy = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {});
  });

  afterEach(() => {
    measureInWindowSpy.mockRestore();
    scrollToSpy.mockRestore();
  });

  function contentPadding(tree: renderer.ReactTestRenderer): number | undefined {
    const scroll = tree.root.findByType(ScrollView);
    return flattenStyle(scroll.props.contentContainerStyle).paddingBottom as number | undefined;
  }

  it('adds no extra padding when the keyboard is hidden', () => {
    mockUseKeyboardInset.mockReturnValue({ height: 0, screenY: 0 });
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <KeyboardFormScroll contentContainerStyle={{ paddingBottom: BASE_PADDING }}>
          <TextInput testID="field" />
        </KeyboardFormScroll>,
      );
    });
    act(() => {
      tree.root.findByType(View).props.onLayout?.({
        nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 300 } },
      });
    });
    expect(contentPadding(tree)).toBe(BASE_PADDING);
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it('adds overlap plus spacing.lg when the keyboard covers the viewport', () => {
    mockUseKeyboardInset.mockReturnValue({ height: 280, screenY: 500 });
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <KeyboardFormScroll contentContainerStyle={{ paddingBottom: BASE_PADDING }}>
          <TextInput testID="field" />
        </KeyboardFormScroll>,
      );
    });
    act(() => {
      tree.root.findByType(View).props.onLayout?.({
        nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 300 } },
      });
    });
    act(() => {});
    const overlap = 400 + 300 - 500;
    expect(contentPadding(tree)).toBe(BASE_PADDING + overlap + spacing.lg);
  });

  it('scrolls focused input when it sits below the keyboard', () => {
    mockUseKeyboardInset.mockReturnValue({ height: 280, screenY: 500 });
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <KeyboardFormScroll contentContainerStyle={{ paddingBottom: BASE_PADDING }}>
          <AppTextInput testID="field" />
        </KeyboardFormScroll>,
      );
    });
    act(() => {
      tree.root.findByType(View).props.onLayout?.({
        nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 300 } },
      });
    });
    act(() => {});

    const inputMeasure = jest
      .spyOn(TextInput.prototype, 'measureInWindow')
      .mockImplementation(function (this: TextInput, callback) {
        callback(0, 520, 300, 48);
      });

    act(() => {
      tree.root.findByType(TextInput).props.onFocus?.({ nativeEvent: {} });
    });
    act(() => {});

    const delta = 520 + 48 + spacing.lg - 500;
    expect(scrollToSpy).toHaveBeenCalledWith(
      expect.objectContaining({ y: expect.any(Number), animated: true }),
    );
    const lastScroll = scrollToSpy.mock.calls.at(-1)?.[0];
    expect(lastScroll && typeof lastScroll === 'object' && 'y' in lastScroll ? lastScroll.y : 0).toBeGreaterThanOrEqual(
      delta - 1,
    );

    inputMeasure.mockRestore();
  });

  it('re-applies padding when keyboard height changes', () => {
    mockUseKeyboardInset.mockReturnValue({ height: 280, screenY: 500 });
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <KeyboardFormScroll contentContainerStyle={{ paddingBottom: BASE_PADDING }} />,
      );
    });
    act(() => {
      tree.root.findByType(View).props.onLayout?.({
        nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 300 } },
      });
    });
    act(() => {});
    const first = contentPadding(tree);

    mockUseKeyboardInset.mockReturnValue({ height: 400, screenY: 350 });
    act(() => {
      tree.update(
        <KeyboardFormScroll contentContainerStyle={{ paddingBottom: BASE_PADDING }} />,
      );
    });
    act(() => {
      tree.root.findByType(View).props.onLayout?.({
        nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 300 } },
      });
    });
    act(() => {});

    expect(contentPadding(tree)).toBeGreaterThan(first as number);
  });
});
