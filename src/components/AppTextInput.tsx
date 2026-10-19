import { forwardRef, useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
} from 'react-native';

import { colors, typography } from '@/constants/theme';

function initialHasText(value?: string, defaultValue?: string): boolean {
  return String(value ?? defaultValue ?? '').length > 0;
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

  const handleChangeText = useCallback(
    (text: string) => {
      setHasText(text.length > 0);
      onChangeText?.(text);
    },
    [onChangeText],
  );

  const showPlaceholder = Boolean(placeholder) && !hasText;

  const placeholderStyle = useMemo((): StyleProp<TextStyle> => {
    return [
      styles.placeholderOverlay,
      {
        paddingTop: flatStyle?.paddingTop ?? flatStyle?.paddingVertical ?? flatStyle?.padding ?? 0,
        paddingRight:
          flatStyle?.paddingRight ?? flatStyle?.paddingHorizontal ?? flatStyle?.padding ?? 0,
        paddingBottom:
          flatStyle?.paddingBottom ?? flatStyle?.paddingVertical ?? flatStyle?.padding ?? 0,
        paddingLeft:
          flatStyle?.paddingLeft ?? flatStyle?.paddingHorizontal ?? flatStyle?.padding ?? 0,
        fontFamily: typography.fonts.regular,
        fontSize: flatStyle?.fontSize ?? typography.sizes.input,
        lineHeight: flatStyle?.lineHeight ?? typography.lineHeights.input,
        textAlign: flatStyle?.textAlign ?? 'left',
        color: placeholderTextColor,
      },
    ];
  }, [flatStyle, placeholderTextColor]);

  return (
    <View style={styles.wrapper}>
      <TextInput
        ref={ref}
        style={[style, styles.inputFont]}
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
        <Text
          pointerEvents="none"
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          numberOfLines={multiline ? undefined : 1}
          style={placeholderStyle}>
          {placeholder}
        </Text>
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
  placeholderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
