import { describe, expect, it } from '@jest/globals';
import { StyleSheet } from 'react-native';

import { basePaddingBottomFromContentStyle } from '@/lib/keyboard-scroll-padding';
import { spacing } from '@/constants/theme';

describe('basePaddingBottomFromContentStyle', () => {
  it('reads paddingBottom, then paddingVertical, then padding', () => {
    expect(basePaddingBottomFromContentStyle({ paddingBottom: spacing.xxl })).toBe(spacing.xxl);
    expect(basePaddingBottomFromContentStyle({ paddingVertical: spacing.section })).toBe(
      spacing.section,
    );
    expect(basePaddingBottomFromContentStyle({ padding: spacing.card })).toBe(spacing.card);
    expect(basePaddingBottomFromContentStyle(undefined)).toBe(0);
  });
});
