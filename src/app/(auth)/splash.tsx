import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, typography } from '@/constants/theme';
import { routeAfterAuthenticatedSession } from '@/lib/onboarding-routing';
import { getSessionToken } from '@/lib/session';

const logo = require('@/assets/images/login/logo.png');

const MIN_SPLASH_MS = 1800;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function SplashScreen() {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(progress, {
        toValue: 1,
        duration: MIN_SPLASH_MS,
        useNativeDriver: false,
      }),
    ]).start();

    async function bootstrap() {
      const startedAt = Date.now();
      let token: string | null = null;

      try {
        token = await getSessionToken();
      } catch {
        token = null;
      }

      const remaining = Math.max(0, MIN_SPLASH_MS - (Date.now() - startedAt));
      await delay(remaining);

      if (cancelled) return;

      await routeAfterAuthenticatedSession(token);
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [opacity, progress, scale]);

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 192],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.ring} pointerEvents="none" />

      <View style={styles.main}>
        <Animated.View style={[styles.brand, { opacity, transform: [{ scale }] }]}>
          <View style={styles.logoCard}>
            <Image source={logo} style={styles.logo} contentFit="contain" />
          </View>
          <Text style={styles.title}>
            ePickup <Text style={styles.titleAccent}>Shop</Text>
          </Text>
          <Text style={styles.tagline}>Efficient Logistics for Modern Small{'\n'}Businesses</Text>
        </Animated.View>

        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
        <Text style={styles.status}>Syncing inventory...</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.secure}>Secure Operations Portal</Text>
        <Text style={styles.version}>v2.4.0 • Enterprise Edition</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  ring: {
    position: 'absolute',
    top: '22%',
    alignSelf: 'center',
    width: 240,
    height: 240,
    borderRadius: 9999,
    backgroundColor: colors.overlayAccent,
  },
  main: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screen,
  },
  brand: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoCard: {
    width: 192,
    height: 192,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 8,
  },
  logo: {
    width: 176,
    height: 176,
  },
  title: {
    marginTop: spacing.xl,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.display,
    lineHeight: typography.lineHeights.display,
    fontWeight: typography.weights.bold,
    letterSpacing: typography.letterSpacing.display,
    color: colors.primary,
    textAlign: 'center',
  },
  titleAccent: {
    color: colors.accent,
  },
  tagline: {
    marginTop: spacing.xs,
    maxWidth: 240,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    opacity: 0.8,
  },
  progressTrack: {
    width: 192,
    height: 6,
    borderRadius: 9999,
    backgroundColor: colors.tintSoft,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 9999,
    backgroundColor: colors.primary,
  },
  status: {
    marginTop: spacing.md,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
    letterSpacing: typography.letterSpacing.overline,
    color: colors.overlayStatus,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xl,
  },
  secure: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
    letterSpacing: typography.letterSpacing.label,
    color: colors.accent,
  },
  version: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
    letterSpacing: typography.letterSpacing.label,
    color: colors.textPlaceholder,
  },
});
