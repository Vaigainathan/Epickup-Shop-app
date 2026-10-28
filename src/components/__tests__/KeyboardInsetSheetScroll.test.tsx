import { beforeEach, afterEach, describe, expect, it, jest } from '@jest/globals';
import { View, ScrollView } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { ConfirmBottomSheet } from '@/components/payment/ConfirmBottomSheet';
import { KeyboardInsetSheetScroll } from '@/components/KeyboardInsetSheetScroll';
import { spacing } from '@/constants/theme';

const mockUseKeyboardInset = jest.fn<() => { height: number; screenY: number }>();

jest.mock('@/hooks/useKeyboardInset', () => ({
  useKeyboardInset: () => mockUseKeyboardInset(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 0, left: 0, right: 0 }),
}));

/** Pre-lift window Y; after lift 401 → 43 (same overlap math as device). */
const PRE_LIFT_Y = 444;
const SHEET_HEIGHT = 388;
const KEYBOARD_SCREEN_Y = 439;
const KEYBOARD_SCREEN_Y_TALL = 300;
const EXPECTED_LIFT = 393 + spacing.sm;
const EXPECTED_LIFT_TALL = 532 + spacing.sm;

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

function scrollProps(tree: renderer.ReactTestRenderer) {
  return tree.root.findByType(ScrollView).props;
}

describe('KeyboardInsetSheetScroll lift', () => {
  let measureInWindowSpy: jest.SpiedFunction<View['measureInWindow']>;
  let simulatedLift = 0;

  beforeEach(() => {
    simulatedLift = 0;
    mockUseKeyboardInset.mockReturnValue({ height: 0, screenY: 0 });
    measureInWindowSpy = jest
      .spyOn(View.prototype, 'measureInWindow')
      .mockImplementation(function (_callback) {
        const callback = _callback as (
          x: number,
          y: number,
          width: number,
          height: number,
        ) => void;
        callback(0, PRE_LIFT_Y - simulatedLift, 400, SHEET_HEIGHT);
      });
  });

  afterEach(() => {
    measureInWindowSpy.mockRestore();
  });

  function syncSimulatedLift(tree: renderer.ReactTestRenderer) {
    const margin = flattenStyle(
      tree.root.findByProps({ testID: 'keyboard-inset-sheet-scroll' }).props.style,
    ).marginBottom;
    simulatedLift = typeof margin === 'number' ? margin : 0;
  }

  function triggerLayout(tree: renderer.ReactTestRenderer) {
    act(() => {
      tree.root.findByProps({ testID: 'keyboard-inset-sheet-scroll' }).props.onLayout?.({
        nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 200 } },
      });
    });
    syncSimulatedLift(tree);
  }

  function renderScroll(basePaddingBottom: number) {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <KeyboardInsetSheetScroll
          basePaddingBottom={basePaddingBottom}
          cardPaddingTop={spacing.card}
          contentContainerStyle={{ gap: spacing.md }}>
          <View />
        </KeyboardInsetSheetScroll>,
      );
    });
    act(() => {});
    syncSimulatedLift(tree);
    triggerLayout(tree);
    return tree;
  }

  function updateScroll(tree: renderer.ReactTestRenderer) {
    act(() => {
      tree.update(
        <KeyboardInsetSheetScroll
          basePaddingBottom={spacing.card}
          cardPaddingTop={spacing.card}
          contentContainerStyle={{ gap: spacing.md }}>
          <View />
        </KeyboardInsetSheetScroll>,
      );
    });
    act(() => {});
    syncSimulatedLift(tree);
    triggerLayout(tree);
  }

  function outerMarginBottom(tree: renderer.ReactTestRenderer): number {
    const node = tree.root.findByProps({ testID: 'keyboard-inset-sheet-scroll' });
    return flattenStyle(node.props.style).marginBottom as number;
  }

  function scrollContentPadding(tree: renderer.ReactTestRenderer): number {
    return flattenStyle(scrollProps(tree).contentContainerStyle).paddingBottom as number;
  }

  function scrollMaxHeight(tree: renderer.ReactTestRenderer): number | undefined {
    return flattenStyle(scrollProps(tree).style).maxHeight as number | undefined;
  }

  it('uses no lift and base content padding when keyboard is hidden', () => {
    mockUseKeyboardInset.mockReturnValue({ height: 0, screenY: 0 });
    const tree = renderScroll(spacing.card);
    expect(outerMarginBottom(tree)).toBe(0);
    expect(scrollContentPadding(tree)).toBe(spacing.card);
    expect(scrollMaxHeight(tree)).toBeUndefined();
  });

  it('uses no lift when keyboard top is at or below sheet bottom (overlap 0)', () => {
    mockUseKeyboardInset.mockReturnValue({ height: 280, screenY: 900 });
    const tree = renderScroll(spacing.card);
    expect(outerMarginBottom(tree)).toBe(0);
    expect(scrollContentPadding(tree)).toBe(spacing.card);
  });

  it('lifts on open (overlap 393) and stays stable on re-measure', () => {
    mockUseKeyboardInset.mockReturnValue({ height: 393, screenY: KEYBOARD_SCREEN_Y });
    const tree = renderScroll(spacing.card);
    expect(outerMarginBottom(tree)).toBe(EXPECTED_LIFT);
    expect(scrollContentPadding(tree)).toBe(spacing.card);
    expect(PRE_LIFT_Y - simulatedLift).toBe(43);

    triggerLayout(tree);
    expect(outerMarginBottom(tree)).toBe(EXPECTED_LIFT);
  });

  it('increases lift when the keyboard grows while already lifted', () => {
    mockUseKeyboardInset.mockReturnValue({ height: 393, screenY: KEYBOARD_SCREEN_Y });
    const tree = renderScroll(spacing.card);
    expect(outerMarginBottom(tree)).toBe(EXPECTED_LIFT);

    mockUseKeyboardInset.mockReturnValue({ height: 500, screenY: KEYBOARD_SCREEN_Y_TALL });
    updateScroll(tree);
    expect(outerMarginBottom(tree)).toBe(EXPECTED_LIFT_TALL);

    triggerLayout(tree);
    expect(outerMarginBottom(tree)).toBe(EXPECTED_LIFT_TALL);
  });

  it('returns lift to the smaller value when the keyboard shrinks again', () => {
    mockUseKeyboardInset.mockReturnValue({ height: 393, screenY: KEYBOARD_SCREEN_Y });
    const tree = renderScroll(spacing.card);

    mockUseKeyboardInset.mockReturnValue({ height: 500, screenY: KEYBOARD_SCREEN_Y_TALL });
    updateScroll(tree);
    expect(outerMarginBottom(tree)).toBe(EXPECTED_LIFT_TALL);

    mockUseKeyboardInset.mockReturnValue({ height: 393, screenY: KEYBOARD_SCREEN_Y });
    updateScroll(tree);
    expect(outerMarginBottom(tree)).toBe(EXPECTED_LIFT);
  });

  it('clears lift and maxHeight on the first render after the keyboard hides', () => {
    mockUseKeyboardInset.mockReturnValue({ height: 393, screenY: KEYBOARD_SCREEN_Y });
    const tree = renderScroll(spacing.card);
    expect(outerMarginBottom(tree)).toBe(EXPECTED_LIFT);
    expect(scrollMaxHeight(tree)).toBeDefined();

    mockUseKeyboardInset.mockReturnValue({ height: 0, screenY: 0 });
    simulatedLift = 0;

    act(() => {
      tree.update(
        <KeyboardInsetSheetScroll
          basePaddingBottom={spacing.card}
          cardPaddingTop={spacing.card}
          contentContainerStyle={{ gap: spacing.md }}>
          <View />
        </KeyboardInsetSheetScroll>,
      );
    });

    expect(outerMarginBottom(tree)).toBe(0);
    expect(scrollMaxHeight(tree)).toBeUndefined();
  });
});

describe('ConfirmBottomSheet', () => {
  let measureSpy: jest.SpiedFunction<View['measureInWindow']>;

  beforeEach(() => {
    mockUseKeyboardInset.mockReturnValue({ height: 0, screenY: 0 });
    measureSpy = jest.spyOn(View.prototype, 'measureInWindow').mockImplementation(function (callback) {
      callback(0, 600, 400, 200);
    });
  });

  afterEach(() => {
    measureSpy.mockRestore();
  });

  it('applies base card padding when keyboard inset is hidden', () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <ConfirmBottomSheet
          visible
          title="Test"
          primaryLabel="OK"
          onPrimary={() => {}}
          onClose={() => {}}
        />,
      );
    });

    act(() => {
      tree.root.findByProps({ testID: 'keyboard-inset-sheet-scroll' }).props.onLayout?.({
        nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 200 } },
      });
    });

    const padding = flattenStyle(scrollProps(tree).contentContainerStyle).paddingBottom;
    expect(padding).toBe(spacing.card);
  });
});
