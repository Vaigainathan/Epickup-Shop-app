import { Image } from 'expo-image';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, typography } from '@/constants/theme';
import { checkShopPhone } from '@/lib/auth-api';
import { isResetIntent, RESET_INTENT } from '@/lib/auth-intent';
import { isValidIndianMobile, startPhoneSignIn, toE164Phone } from '@/lib/phone-auth';

const RESET_GENERIC_ERROR = "We couldn't send a reset code. Please try again.";

const logo = require('@/assets/images/login/logo.png');
const blobTop = require('@/assets/images/login/blob-top.png');
const blobBottom = require('@/assets/images/login/blob-bottom.png');
const flagIcon = require('@/assets/images/login/flag.png');
const arrowIcon = require('@/assets/images/login/arrow.png');

export default function SignUpPhoneScreen() {
  const { intent } = useLocalSearchParams<{ intent?: string }>();
  const reset = isResetIntent(intent);

  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState(false);

  const digits = phone.replace(/\D/g, '').slice(0, 10);
  const canSubmit = isValidIndianMobile(digits) && !loading;

  async function submit() {
    if (!canSubmit) {
      setPhoneError('Enter a valid 10-digit mobile number');
      return;
    }

    setPhoneError(null);
    setNetworkError(false);
    setLoading(true);

    const phoneE164 = toE164Phone(digits);

    try {
      const check = await checkShopPhone(phoneE164);
      if (reset) {
        if (!check.exists) {
          setPhoneError(RESET_GENERIC_ERROR);
          return;
        }
      } else if (check.exists) {
        router.replace({
          pathname: '/(auth)/login',
          params: {
            message: 'This number is already registered. Please log in.',
          },
        });
        return;
      }

      await startPhoneSignIn(phoneE164);
      router.push({
        pathname: '/(auth)/sign-up/otp',
        params: reset
          ? { phone: phoneE164, intent: RESET_INTENT }
          : { phone: phoneE164 },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (
        message.toLowerCase().includes('network') ||
        message.toLowerCase().includes('fetch') ||
        message.length === 0
      ) {
        setNetworkError(true);
      } else {
        setPhoneError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  if (networkError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.networkError}>
          <Text style={styles.networkTitle}>Couldn't reach the server</Text>
          <Text style={styles.networkBody}>
            Check your connection and try again. This is not a phone number error.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={submit}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
            <Text style={styles.buttonLabel}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Image source={blobTop} style={styles.blobTop} contentFit="contain" pointerEvents="none" />
      <Image source={blobBottom} style={styles.blobBottom} contentFit="contain" pointerEvents="none" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.branding}>
            <View style={styles.logoCard}>
              <Image source={logo} style={styles.logo} contentFit="contain" />
            </View>
            <Text style={styles.title}>{reset ? 'Reset Password' : 'Create Shop Account'}</Text>
            <Text style={styles.subtitle}>
              {reset
                ? 'Verify to reset your password'
                : "Enter your mobile number. We'll send a one-time code to verify it's you."}
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={[styles.inputShell, phoneError && styles.inputError]}>
                <View style={styles.prefix}>
                  <Image source={flagIcon} style={styles.flag} contentFit="contain" />
                  <Text style={styles.prefixText}>+91</Text>
                </View>
                <TextInput
                  value={digits}
                  onChangeText={(value) => {
                    setPhone(value.replace(/\D/g, '').slice(0, 10));
                    if (phoneError) setPhoneError(null);
                  }}
                  placeholder="98765 43210"
                  placeholderTextColor={colors.textPlaceholder}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  maxLength={10}
                  editable={!loading}
                  style={styles.input}
                />
              </View>
              {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={!canSubmit}
              onPress={submit}
              style={({ pressed }) => [
                styles.button,
                !canSubmit && styles.buttonDisabled,
                pressed && canSubmit && styles.pressed,
              ]}>
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Text style={styles.buttonLabel}>Send OTP</Text>
                  <Image source={arrowIcon} style={styles.arrow} contentFit="contain" />
                </>
              )}
            </Pressable>
          </View>

          <View style={styles.footer} pointerEvents={loading ? 'none' : 'auto'}>
            <View style={styles.registerRow}>
              {reset ? (
                <Link href="/(auth)/login" asChild>
                  <Pressable disabled={loading}>
                    <Text style={styles.register}>Back to log in</Text>
                  </Pressable>
                </Link>
              ) : (
                <>
                  <Text style={styles.footerText}>Already have an account? </Text>
                  <Link href="/(auth)/login" asChild>
                    <Pressable disabled={loading}>
                      <Text style={styles.register}>Log in</Text>
                    </Pressable>
                  </Link>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.section,
    alignItems: 'center',
  },
  blobTop: {
    position: 'absolute',
    top: -96,
    left: -96,
    width: 256,
    height: 256,
    opacity: 0.4,
  },
  blobBottom: {
    position: 'absolute',
    right: -128,
    bottom: 80,
    width: 320,
    height: 320,
    opacity: 0.4,
  },
  branding: {
    alignItems: 'center',
    width: '100%',
  },
  logoCard: {
    width: 128,
    height: 128,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  logo: {
    width: 112,
    height: 112,
  },
  title: {
    marginTop: spacing.md,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.heading,
    lineHeight: typography.lineHeights.heading,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.heading,
    color: colors.heading,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: spacing.xs,
    maxWidth: 300,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.regular,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    marginTop: spacing.section,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    gap: spacing.md,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    marginLeft: spacing.xs,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
    letterSpacing: typography.letterSpacing.label,
    color: colors.textSecondary,
  },
  inputShell: {
    minHeight: spacing.input,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.white,
  },
  inputError: {
    borderColor: colors.error,
  },
  prefix: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingRight: 9,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  flag: {
    width: 13,
    height: 14,
  },
  prefixText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    lineHeight: typography.lineHeights.input,
    fontWeight: typography.weights.regular,
    color: colors.textSecondary,
  },
  input: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    fontWeight: typography.weights.regular,
    color: colors.heading,
    paddingVertical: 0,
  },
  errorText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
    color: colors.error,
  },
  button: {
    height: spacing.input,
    borderRadius: 9999,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.9,
  },
  buttonLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.button,
    color: colors.white,
  },
  arrow: {
    width: 13,
    height: 13,
  },
  footer: {
    marginTop: spacing.section,
    alignItems: 'center',
  },
  registerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  footerText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.regular,
    color: colors.textSecondary,
  },
  register: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  networkError: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.screen,
    gap: spacing.md,
  },
  networkTitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.headingSm,
    lineHeight: typography.lineHeights.headingSm,
    fontWeight: typography.weights.semibold,
    color: colors.heading,
    textAlign: 'center',
  },
  networkBody: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.regular,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
