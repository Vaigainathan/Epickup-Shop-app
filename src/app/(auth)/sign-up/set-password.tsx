import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
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
import { setShopPassword } from '@/lib/auth-api';
import { isResetIntent } from '@/lib/auth-intent';
import { routeAfterAuthenticatedSession } from '@/lib/onboarding-routing';
import { getSessionToken } from '@/lib/session';

const logo = require('@/assets/images/login/logo.png');
const blobTop = require('@/assets/images/login/blob-top.png');
const blobBottom = require('@/assets/images/login/blob-bottom.png');
const lockIcon = require('@/assets/images/login/lock.png');
const eyeIcon = require('@/assets/images/login/eye.png');
const arrowIcon = require('@/assets/images/login/arrow.png');

type Requirement = {
  id: string;
  label: string;
  test: (value: string) => boolean;
};

const REQUIREMENTS: Requirement[] = [
  { id: 'length', label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { id: 'upper', label: 'One uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { id: 'lower', label: 'One lowercase letter', test: (v) => /[a-z]/.test(v) },
  { id: 'number', label: 'One number', test: (v) => /\d/.test(v) },
  {
    id: 'special',
    label: 'One special character',
    test: (v) => /[^A-Za-z0-9]/.test(v),
  },
];

export default function SetPasswordScreen() {
  const { intent } = useLocalSearchParams<{ intent?: string }>();
  const reset = isResetIntent(intent);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState(false);

  const checks = useMemo(
    () => REQUIREMENTS.map((req) => ({ ...req, met: req.test(password) })),
    [password],
  );

  const allMet = checks.every((check) => check.met);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const canSubmit = allMet && passwordsMatch && !loading;

  async function submit() {
    if (!canSubmit) return;

    setFormError(null);
    setNetworkError(false);
    setLoading(true);

    try {
      const token = await getSessionToken();
      if (!token) {
        setFormError('Your session expired. Please verify your phone again.');
        return;
      }

      await setShopPassword(password, token);
      if (reset) {
        await routeAfterAuthenticatedSession(token);
        return;
      }
      router.replace('/(auth)/sign-up/business-details');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (
        message.toLowerCase().includes('network') ||
        message.toLowerCase().includes('fetch') ||
        message.length === 0
      ) {
        setNetworkError(true);
      } else {
        setFormError(message);
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
            Check your connection and try again. Your password was not saved.
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
            <Text style={styles.title}>{reset ? 'Reset Password' : 'Set Password'}</Text>
            <Text style={styles.subtitle}>
              {reset
                ? "Choose a new password for your shop login. You'll use this with your phone number."
                : "Create a strong password for your shop login. You'll use this with your phone number."}
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputShell}>
                <Image source={lockIcon} style={styles.lock} contentFit="contain" />
                <TextInput
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    if (formError) setFormError(null);
                  }}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textPlaceholder}
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                  editable={!loading}
                  style={styles.input}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  disabled={loading}
                  hitSlop={8}
                  onPress={() => setShowPassword((visible) => !visible)}
                  style={styles.eyeButton}>
                  <Image source={eyeIcon} style={styles.eye} contentFit="contain" />
                </Pressable>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Confirm Password</Text>
              <View
                style={[
                  styles.inputShell,
                  confirmPassword.length > 0 && !passwordsMatch && styles.inputError,
                ]}>
                <Image source={lockIcon} style={styles.lock} contentFit="contain" />
                <TextInput
                  value={confirmPassword}
                  onChangeText={(value) => {
                    setConfirmPassword(value);
                    if (formError) setFormError(null);
                  }}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textPlaceholder}
                  secureTextEntry={!showConfirm}
                  autoComplete="new-password"
                  editable={!loading}
                  style={styles.input}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showConfirm ? 'Hide password' : 'Show password'}
                  disabled={loading}
                  hitSlop={8}
                  onPress={() => setShowConfirm((visible) => !visible)}
                  style={styles.eyeButton}>
                  <Image source={eyeIcon} style={styles.eye} contentFit="contain" />
                </Pressable>
              </View>
              {confirmPassword.length > 0 && !passwordsMatch ? (
                <Text style={styles.errorText}>Passwords do not match</Text>
              ) : null}
            </View>

            <View style={styles.requirements}>
              <Text style={styles.requirementsTitle}>Password must include</Text>
              {checks.map((check) => (
                <View key={check.id} style={styles.requirementRow}>
                  <View style={[styles.checkDot, check.met && styles.checkDotMet]} />
                  <Text style={[styles.requirementText, check.met && styles.requirementMet]}>
                    {check.label}
                  </Text>
                </View>
              ))}
            </View>

            {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

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
                  <Text style={styles.buttonLabel}>Continue</Text>
                  <Image source={arrowIcon} style={styles.arrow} contentFit="contain" />
                </>
              )}
            </Pressable>
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
  lock: {
    width: 16,
    height: 21,
  },
  input: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    fontWeight: typography.weights.regular,
    color: colors.heading,
    paddingVertical: 0,
  },
  eyeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eye: {
    width: 22,
    height: 15,
  },
  requirements: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  requirementsTitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
    letterSpacing: typography.letterSpacing.label,
    color: colors.textSecondary,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkDot: {
    width: 10,
    height: 10,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.white,
  },
  checkDotMet: {
    borderColor: colors.success,
    backgroundColor: colors.success,
  },
  requirementText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.regular,
    color: colors.textMuted,
  },
  requirementMet: {
    color: colors.success,
    fontWeight: typography.weights.medium,
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
