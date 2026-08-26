import { Image } from 'expo-image';
import { Link, router } from 'expo-router';
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
import { apiUrl } from '@/lib/api';
import { extractSessionToken, setSessionToken } from '@/lib/session';

const logo = require('@/assets/images/login/logo.png');
const blobTop = require('@/assets/images/login/blob-top.png');
const blobBottom = require('@/assets/images/login/blob-bottom.png');
const flagIcon = require('@/assets/images/login/flag.png');
const lockIcon = require('@/assets/images/login/lock.png');
const eyeIcon = require('@/assets/images/login/eye.png');
const arrowIcon = require('@/assets/images/login/arrow.png');

function toE164Phone(value: string) {
  const digits = value.replace(/\D/g, '');
  return `+91${digits}`;
}

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState(false);

  async function submit() {
    if (loading) return;

    setPasswordError(null);
    setNetworkError(false);
    setLoading(true);

    try {
      const response = await fetch(apiUrl('/api/shop/auth/login'), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: toE164Phone(phone),
          password,
        }),
      });

      if (response.ok) {
        try {
          const body = await response.json();
          const token = extractSessionToken(body);
          if (token) {
            await setSessionToken(token);
          }
        } catch {
          // Persist is best-effort; continue to dashboard after a successful login.
        }
        router.replace('/(dashboard)');
        return;
      }

      if (response.status === 401) {
        setPasswordError('Invalid phone number or password');
        return;
      }

      setNetworkError(true);
    } catch {
      setNetworkError(true);
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
            Check your connection and try again. This is not a password error.
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
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>
              Sign in with your registered mobile number to manage your shop.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={styles.inputShell}>
                <View style={styles.prefix}>
                  <Image source={flagIcon} style={styles.flag} contentFit="contain" />
                  <Text style={styles.prefixText}>+91</Text>
                </View>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="98765 43210"
                  placeholderTextColor={colors.textPlaceholder}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  editable={!loading}
                  style={styles.input}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View style={[styles.inputShell, passwordError && styles.inputError]}>
                <Image source={lockIcon} style={styles.lock} contentFit="contain" />
                <TextInput
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    if (passwordError) setPasswordError(null);
                  }}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textPlaceholder}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
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
              {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
            </View>

            <Link href="/(auth)/forgot-password" asChild>
              <Pressable disabled={loading} style={styles.forgotWrap}>
                <Text style={styles.forgot}>Forgot Password?</Text>
              </Pressable>
            </Link>

            <Pressable
              accessibilityRole="button"
              disabled={loading}
              onPress={submit}
              style={({ pressed }) => [styles.button, pressed && !loading && styles.pressed]}>
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Text style={styles.buttonLabel}>Login</Text>
                  <Image source={arrowIcon} style={styles.arrow} contentFit="contain" />
                </>
              )}
            </Pressable>
          </View>

          <View style={styles.footer} pointerEvents={loading ? 'none' : 'auto'}>
            <View style={styles.registerRow}>
              <Text style={styles.footerText}>Don't have a shop account? </Text>
              <Link href="/(auth)/sign-up" asChild>
                <Pressable disabled={loading}>
                  <Text style={styles.register}>Register</Text>
                </Pressable>
              </Link>
            </View>
            <View style={styles.versionRow}>
              <View style={styles.versionRule} />
              <Text style={styles.version}>v2.4.0</Text>
              <View style={styles.versionRule} />
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
    maxWidth: 280,
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
  errorText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
    color: colors.error,
  },
  forgotWrap: {
    alignSelf: 'flex-end',
  },
  forgot: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.bold,
    color: colors.primary,
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
    gap: spacing.md,
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
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  versionRule: {
    width: 48,
    height: 1,
    backgroundColor: colors.border,
  },
  version: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
    letterSpacing: typography.letterSpacing.label,
    color: colors.textMuted,
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
