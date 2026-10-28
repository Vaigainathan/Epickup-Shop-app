import { type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { KeyboardInsetSheetScroll } from '@/components/KeyboardInsetSheetScroll';
import { colors, spacing, typography } from '@/constants/theme';

type Props = {
  visible: boolean;
  title: string;
  body?: string;
  primaryLabel: string;
  secondaryLabel?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
  onClose: () => void;
  busy?: boolean;
  primaryDisabled?: boolean;
  children?: ReactNode;
};

export function ConfirmBottomSheet({
  visible,
  title,
  body,
  primaryLabel,
  secondaryLabel = 'Go back',
  onPrimary,
  onSecondary,
  onClose,
  busy,
  primaryDisabled,
  children,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => !busy && onClose()}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismiss} onPress={() => !busy && onClose()} />
        <View style={styles.card}>
          <KeyboardInsetSheetScroll
            basePaddingBottom={spacing.card}
            cardPaddingTop={spacing.card}
            contentContainerStyle={styles.sheetContent}>
            <View style={styles.handle} />
            <Text style={styles.title}>{title}</Text>
            {body ? <Text style={styles.body}>{body}</Text> : null}
            {children}
            <Pressable
              accessibilityRole="button"
              disabled={busy || primaryDisabled}
              onPress={onPrimary}
              style={({ pressed }) => [
                styles.primary,
                (busy || primaryDisabled) && styles.disabled,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.primaryLabel}>{primaryLabel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={onSecondary ?? onClose}
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
              <Text style={styles.secondaryLabel}>{secondaryLabel}</Text>
            </Pressable>
          </KeyboardInsetSheetScroll>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  dismiss: {
    flex: 1,
  },
  card: {
    paddingHorizontal: spacing.card,
    paddingTop: spacing.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.surface,
  },
  sheetContent: {
    gap: spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 9999,
    backgroundColor: colors.border,
  },
  title: {
    fontSize: typography.sizes.headingSm,
    lineHeight: typography.lineHeights.headingSm,
    fontFamily: typography.fonts.semibold,
    color: colors.heading,
    textAlign: 'center',
  },
  body: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  primary: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  primaryLabel: {
    fontSize: typography.sizes.body,
    fontFamily: typography.fonts.semibold,
    color: colors.white,
  },
  secondary: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.tintSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontSize: typography.sizes.body,
    fontFamily: typography.fonts.semibold,
    color: colors.heading,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.9,
  },
});
