import { describe, expect, it, jest } from '@jest/globals';
import { createRef } from 'react';
import { TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { AppTextInput } from '@/components/AppTextInput';
import { KeyboardFormScrollContext } from '@/components/KeyboardFormScroll';

describe('AppTextInput keyboard scroll context', () => {
  it('forwards ref and calls only caller focus handlers without a provider', () => {
    const ref = createRef<TextInput>();
    const onFocus = jest.fn();
    const onBlur = jest.fn();

    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <AppTextInput testID="field" ref={ref} onFocus={onFocus} onBlur={onBlur} />,
      );
    });

    act(() => {
      tree.root.findByType(TextInput).props.onFocus?.({ nativeEvent: {} });
    });
    expect(onFocus).toHaveBeenCalledTimes(1);

    act(() => {
      tree.root.findByType(TextInput).props.onBlur?.({ nativeEvent: {} });
    });
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(ref.current).toBe(tree.root.findByType(TextInput).instance);
  });

  it('registers and unregisters with a provider after caller handlers', () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    const registerFocused = jest.fn();
    const unregisterFocused = jest.fn();

    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <KeyboardFormScrollContext.Provider
          value={{ registerFocused, unregisterFocused }}>
          <AppTextInput testID="field" onFocus={onFocus} onBlur={onBlur} />
        </KeyboardFormScrollContext.Provider>,
      );
    });

    act(() => {
      tree.root.findByType(TextInput).props.onFocus?.({ nativeEvent: {} });
    });
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(registerFocused).toHaveBeenCalledTimes(1);

    act(() => {
      tree.root.findByType(TextInput).props.onBlur?.({ nativeEvent: {} });
    });
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(unregisterFocused).toHaveBeenCalledTimes(1);
  });
});
