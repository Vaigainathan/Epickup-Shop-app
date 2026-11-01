import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/constants/theme';
import { useNotificationPermissionBanner } from '@/lib/notification-permission-context';

export function NotificationsOffBanner() {
  const { showBanner, recheck } = useNotificationPermissionBanner();

  if (!showBanner) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>Notifications are off — Enable</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          void Linking.openSettings().finally(() => recheck());
        }}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <Text style={styles.buttonLabel}>Open settings</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: colors.overlayPrimary,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  text: {
    flex: 1,
    fontFamily: typography.fonts.semibold,
    fontSize: typography.sizes.body,
    color: colors.heading,
  },
  button: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  buttonLabel: {
    fontFamily: typography.fonts.semibold,
    fontSize: typography.sizes.body,
    color: colors.primary,
  },
  pressed: {
    opacity: 0.9,
  },
});
