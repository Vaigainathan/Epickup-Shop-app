import { forwardRef, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import { colors, typography } from '@/constants/theme';

const WRAPPER_LAYOUT_KEYS = new Set([
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'alignSelf',
  'width',
  'minWidth',
  'maxWidth',
  'margin',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'marginHorizontal',
  'marginVertical',
  'marginStart',
  'marginEnd',
]);

function initialHasText(value?: string, defaultValue?: string): boolean {
  return String(value ?? defaultValue ?? '').length > 0;
}

function splitInputStyle(flat: TextStyle | undefined): { wrapper: ViewStyle; input: TextStyle } {
  const wrapper: ViewStyle = {};
  const input: TextStyle = {};

  if (!flat) {
    return { wrapper, input };
  }

  for (const key of Object.keys(flat) as (keyof TextStyle)[]) {
    const value = flat[key];
    if (value === undefined) continue;
    if (WRAPPER_LAYOUT_KEYS.has(key)) {
      (wrapper as Record<string, unknown>)[key] = value;
    } else {
      (input as Record<string, unknown>)[key] = value;
    }
  }

  const hasFlexLayout =
    wrapper.flex !== undefined ||
    wrapper.flexGrow !== undefined ||
    wrapper.flexShrink !== undefined ||
    wrapper.flexBasis !== undefined;

  if (hasFlexLayout) {
    if (wrapper.flexGrow === undefined) wrapper.flexGrow = 1;
    if (wrapper.flexShrink === undefined) wrapper.flexShrink = 1;
    if (wrapper.minWidth === undefined) wrapper.minWidth = 0;
  }

  return { wrapper, input };
}

function inputPadding(flat: TextStyle | undefined) {
  const padding = flat?.padding ?? 0;
  const paddingHorizontal = flat?.paddingHorizontal ?? padding;
  const paddingVertical = flat?.paddingVertical ?? padding;
  return {
    paddingTop: flat?.paddingTop ?? paddingVertical,
    paddingRight: flat?.paddingRight ?? paddingHorizontal,
    paddingBottom: flat?.paddingBottom ?? paddingVertical,
    paddingLeft: flat?.paddingLeft ?? paddingHorizontal,
  };
}

export const AppTextInput = forwardRef<TextInput, TextInputProps>(function AppTextInput(
  {
    style,
    placeholder,
    placeholderTextColor = colors.textPlaceholder,
    value,
    defaultValue,
    onChangeText,
    multiline,
    editable = true,
    secureTextEntry,
    ...rest
  },
  ref,
) {
  const [hasText, setHasText] = useState(() => initialHasText(value, defaultValue));

  useEffect(() => {
    if (value !== undefined) {
      setHasText(value.length > 0);
    }
  }, [value]);

  const flatStyle = useMemo(() => StyleSheet.flatten(style) as TextStyle | undefined, [style]);
  const { wrapper: wrapperStyle, input: inputStyle } = useMemo(
    () => splitInputStyle(flatStyle),
    [flatStyle],
  );

  const fillsWrapper = useMemo(
    () =>
      wrapperStyle.flex !== undefined ||
      wrapperStyle.flexGrow !== undefined ||
      wrapperStyle.width === '100%' ||
      wrapperStyle.alignSelf === 'stretch',
    [wrapperStyle],
  );

  const handleChangeText = useCallback(
    (text: string) => {
      setHasText(text.length > 0);
      onChangeText?.(text);
    },
    [onChangeText],
  );

  const showPlaceholder = Boolean(placeholder) && !hasText;

  const pad = useMemo(() => inputPadding(inputStyle), [inputStyle]);

  const placeholderTextStyle = useMemo((): TextStyle => {
    return {
      fontFamily: typography.fonts.regular,
      fontSize: inputStyle.fontSize ?? typography.sizes.input,
      lineHeight: inputStyle.lineHeight ?? typography.lineHeights.input,
      textAlign: inputStyle.textAlign ?? 'left',
      color: placeholderTextColor,
      ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
    };
  }, [inputStyle, placeholderTextColor]);

  const placeholderContainerStyle = useMemo((): ViewStyle => {
    return {
      paddingLeft: pad.paddingLeft,
      paddingRight: pad.paddingRight,
      paddingTop: multiline ? pad.paddingTop : 0,
      paddingBottom: multiline ? pad.paddingBottom : 0,
      justifyContent: multiline ? 'flex-start' : 'center',
    };
  }, [multiline, pad]);

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, wrapperStyle]}>
      <TextInput
        ref={ref}
        style={[inputStyle, styles.inputFont, fillsWrapper && styles.inputFill]}
        placeholder=""
        placeholderTextColor="transparent"
        value={value}
        defaultValue={defaultValue}
        onChangeText={handleChangeText}
        multiline={multiline}
        editable={editable}
        secureTextEntry={secureTextEntry}
        accessibilityLabel={rest.accessibilityLabel ?? placeholder}
        {...rest}
      />
      {showPlaceholder ? (
        <View
          pointerEvents="none"
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={[styles.placeholderOverlay, placeholderContainerStyle]}>
          <Text numberOfLines={multiline ? undefined : 1} style={placeholderTextStyle}>
            {placeholder}
          </Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  inputFont: {
    fontFamily: typography.fonts.regular,
  },
  inputFill: {
    alignSelf: 'stretch',
    width: '100%',
  },
  placeholderOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
});
