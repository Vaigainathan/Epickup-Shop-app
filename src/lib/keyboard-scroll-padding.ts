import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

export function basePaddingBottomFromContentStyle(
  contentContainerStyle: StyleProp<ViewStyle> | undefined,
): number {
  const flat = StyleSheet.flatten(contentContainerStyle);
  if (!flat) return 0;
  if (typeof flat.paddingBottom === 'number') return flat.paddingBottom;
  if (typeof flat.paddingVertical === 'number') return flat.paddingVertical;
  if (typeof flat.padding === 'number') return flat.padding;
  return 0;
}
