import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppTextInput } from '@/components/AppTextInput';
import { colors, spacing, typography } from '@/constants/theme';
import { validateUpiRegisteredName } from '@/lib/upi-registered-name';

type Props = {
  visible: boolean;
  initialName: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (name: string) => void;
};

export function UpiRegisteredNameSheet({
  visible,
  initialName,
  busy,
  error,
  onClose,
  onSave,
}: Props) {
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (visible) setName(initialName);
  }, [visible, initialName]);

  const validation = validateUpiRegisteredName(name);
  const canSave = validation.ok && !busy;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => !busy && onClose()}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismiss} onPress={() => !busy && onClose()} />
        <View style={styles.card}>
          <View style={styles.handle} />
          <Text style={styles.title}>Registered UPI name</Text>
          <Text style={styles.warning}>
            This must match the name shown in your UPI app. Changing it clears verification — you
            won’t receive marketplace orders until support verifies the new name.
          </Text>
          <AppTextInput
            value={name}
            onChangeText={setName}
            placeholder="Name as on UPI"
            placeholderTextColor={colors.textPlaceholder}
            editable={!busy}
            maxLength={100}
            style={styles.input}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={!canSave}
            onPress={() => validation.ok && onSave(validation.value)}
            style={({ pressed }) => [
              styles.primary,
              !canSave && styles.disabled,
              pressed && styles.pressed,
            ]}>
            {busy ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.primaryLabel}>Save</Text>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onClose}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
            <Text style={styles.secondaryLabel}>Go back</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlayStatus,
  },
  dismiss: { flex: 1 },
  card: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.section,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  title: {
    fontFamily: typography.fonts.semibold,
    fontSize: typography.sizes.headingSm,
    color: colors.heading,
  },
  warning: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.error,
  },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.input,
    color: colors.heading,
  },
  error: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.body,
    color: colors.error,
  },
  primary: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    fontFamily: typography.fonts.semibold,
    fontSize: typography.sizes.input,
    color: colors.white,
  },
  secondary: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontFamily: typography.fonts.semibold,
    fontSize: typography.sizes.body,
    color: colors.primary,
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.9 },
});
