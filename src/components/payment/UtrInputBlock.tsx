import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, spacing, typography } from '@/constants/theme';
import type { ConfirmUtrFieldMode } from '@/lib/utr-validation';

type Props = {
  mode: ConfirmUtrFieldMode;
  last4: string;
  full12: string;
  onLast4Change: (v: string) => void;
  onFull12Change: (v: string) => void;
  showFull12: boolean;
  disabled?: boolean;
};

export function UtrInputBlock({
  mode,
  last4,
  full12,
  onLast4Change,
  onFull12Change,
  showFull12,
  disabled,
}: Props) {
  const useFullOnly = mode.mode === 'full12' || showFull12;

  return (
    <View style={styles.wrap}>
      {useFullOnly ? (
        <>
          <Text style={styles.hint}>Enter the full 12-digit UTR from your UPI app.</Text>
          <TextInput
            value={full12}
            onChangeText={onFull12Change}
            placeholder="12-digit UTR"
            placeholderTextColor={colors.textPlaceholder}
            keyboardType="number-pad"
            maxLength={12}
            editable={!disabled}
            style={styles.input}
          />
        </>
      ) : (
        <>
          {mode.hintLast4 ? (
            <Text style={styles.hint}>Enter the last 4 digits of the UTR{mode.balanceMode ? ' (balance payment)' : ''}.</Text>
          ) : null}
          <TextInput
            value={last4}
            onChangeText={onLast4Change}
            placeholder="Last 4 of UTR"
            placeholderTextColor={colors.textPlaceholder}
            keyboardType="number-pad"
            maxLength={4}
            editable={!disabled}
            style={styles.input}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  hint: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.textSecondary,
    textAlign: 'left',
  },
  input: {
    height: spacing.input,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.input,
    color: colors.heading,
    backgroundColor: colors.background,
  },
});
