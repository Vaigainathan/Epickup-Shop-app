import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, typography } from '@/constants/theme';
import { formatShopOpenIndicator, type ShopOpenIndicatorInput } from '@/lib/shop-open-indicator';
import { shopOpenChipVariant } from '@/lib/shop-open-chip';

const logo = require('@/assets/images/login/logo.png');

type ShopAppHeaderProps = {
  status: ShopOpenIndicatorInput;
  onProfilePress: () => void;
  profileAccessibilityLabel?: string;
};

export function ShopAppHeader({
  status,
  onProfilePress,
  profileAccessibilityLabel = 'Profile',
}: ShopAppHeaderProps) {
  const label = formatShopOpenIndicator(status);
  const variant = shopOpenChipVariant(status);

  const chipStyles = chipVariantStyles[variant];

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.topRow}>
          <View style={styles.brand}>
            <Image source={logo} style={styles.logo} contentFit="contain" />
            <Text style={styles.title}>ePickup Shop</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={profileAccessibilityLabel}
            onPress={onProfilePress}
            style={({ pressed }) => [styles.profileButton, pressed && styles.pressed]}>
            <MaterialCommunityIcons name="account-outline" size={16} color={colors.white} />
          </Pressable>
        </View>
        <View style={[styles.chip, chipStyles.pill]}>
          <View style={[styles.dot, chipStyles.dot]} />
          <Text numberOfLines={2} style={[styles.chipText, chipStyles.text]}>
            {label}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const chipVariantStyles = {
  openNow: {
    pill: { backgroundColor: colors.overlayTrust },
    dot: { backgroundColor: colors.accent },
    text: { color: colors.success },
  },
  outsideHours: {
    pill: { backgroundColor: colors.tintSoft },
    dot: { backgroundColor: colors.warning },
    text: { color: colors.textSecondary },
  },
  manuallyClosed: {
    pill: { backgroundColor: colors.overlayPrimary },
    dot: { backgroundColor: colors.error },
    text: { color: colors.error },
  },
} as const;

const styles = StyleSheet.create({
  safeArea: {
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: colors.overlayHeader,
    zIndex: 2,
    elevation: 2,
  },
  header: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.overlayHeader,
    gap: spacing.xs,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brand: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  logo: {
    width: 32,
    height: 32,
    flexShrink: 0,
  },
  title: {
    flexShrink: 0,
    fontSize: typography.sizes.headingSm,
    lineHeight: typography.lineHeights.headingSm,
    fontFamily: typography.fonts.semibold,
    color: colors.primary,
  },
  profileButton: {
    width: 32,
    height: 32,
    borderRadius: 9999,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    zIndex: 3,
    elevation: 3,
  },
  pressed: {
    opacity: 0.85,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    borderRadius: 9999,
    paddingVertical: spacing.xs,
    paddingLeft: 12,
    paddingRight: 14,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 9999,
  },
  chipText: {
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontFamily: typography.fonts.medium,
    letterSpacing: 0,
    includeFontPadding: false,
    paddingRight: 2,
  },
});
