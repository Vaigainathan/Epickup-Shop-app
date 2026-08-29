import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, typography } from '@/constants/theme';
import { verifyFirebaseShopToken } from '@/lib/auth-api';
import { isResetIntent, RESET_INTENT } from '@/lib/auth-intent';
import {
  clearPendingPhoneAuth,
  confirmPhoneCode,
  getPendingPhoneAuth,
  resendPhoneCode,
} from '@/lib/phone-auth';
import {
  extractRefreshToken,
  extractSessionToken,
  setSessionTokens,
} from '@/lib/session';

const logo = require('@/assets/images/login/logo.png');
const blobTop = require('@/assets/images/login/blob-top.png');
const blobBottom = require('@/assets/images/login/blob-bottom.png');

const RESEND_SECONDS = 30;
const OTP_LENGTH = 6;

export default function SignUpOtpScreen() {
  const { phone: phoneParam, intent } = useLocalSearchParams<{ phone?: string; intent?: string }>();
  const reset = isResetIntent(intent);
  const pending = getPendingPhoneAuth();
  const phone = phoneParam ?? pending?.phone ?? '';

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const inputsRef = useRef<Array<TextInput | null>>([]);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!getPendingPhoneAuth()) {
      if (reset) {
        router.replace({
          pathname: '/(auth)/sign-up',
          params: { intent: RESET_INTENT },
        });
      } else {
        router.replace('/(auth)/sign-up');
      }
    }
  }, [reset]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const code = digits.join('');

  async function verify(codeValue: string) {
    if (submittingRef.current || codeValue.length !== OTP_LENGTH) return;
    submittingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const { idToken } = await confirmPhoneCode(codeValue);
      const body = await verifyFirebaseShopToken(idToken);
      const token = extractSessionToken(body);
      const refreshToken = extractRefreshToken(body);

      if (!token) {
        throw new Error('Server did not return a session token.');
      }

      await setSessionTokens(token, refreshToken);
      clearPendingPhoneAuth();
      if (reset) {
        router.replace({
          pathname: '/(auth)/sign-up/set-password',
          params: { intent: RESET_INTENT },
        });
      } else {
        router.replace('/(auth)/sign-up/set-password');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid verification code';
      setError(message);
      setDigits(Array(OTP_LENGTH).fill(''));
      inputsRef.current[0]?.focus();
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }

  function applyDigits(next: string[]) {
    setDigits(next);
    const joined = next.join('');
    if (joined.length === OTP_LENGTH && next.every((d) => d.length === 1)) {
      verify(joined);
    }
  }

  function handleChange(index: number, value: string) {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length > 1) {
      const chars = cleaned.slice(0, OTP_LENGTH).split('');
      const next = Array(OTP_LENGTH).fill('');
      chars.forEach((char, i) => {
        next[i] = char;
      });
      applyDigits(next);
      const focusAt = Math.min(chars.length, OTP_LENGTH - 1);
      inputsRef.current[focusAt]?.focus();
      return;
    }

    const next = [...digits];
    next[index] = cleaned.slice(-1);
    applyDigits(next);

    if (cleaned && index < OTP_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handleKeyPress(
    index: number,
    event: NativeSyntheticEvent<TextInputKeyPressEventData>,
  ) {
    if (event.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
    }
  }

  async function resend() {
    if (secondsLeft > 0 || loading) return;
    setError(null);
    setLoading(true);
    try {
      await resendPhoneCode();
      setDigits(Array(OTP_LENGTH).fill(''));
      setSecondsLeft(RESEND_SECONDS);
      inputsRef.current[0]?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend OTP');
    } finally {
      setLoading(false);
    }
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
            <Text style={styles.title}>Verify OTP</Text>
            <Text style={styles.subtitle}>
              {reset ? 'Verify to reset your password' : 'Enter the 6-digit code sent to'}
              {'\n'}
              <Text style={styles.phoneHighlight}>{phone || 'your phone'}</Text>
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.otpRow}>
              {digits.map((digit, index) => (
                <TextInput
                  key={`otp-${index}`}
                  ref={(ref) => {
                    inputsRef.current[index] = ref;
                  }}
                  value={digit}
                  onChangeText={(value) => handleChange(index, value)}
                  onKeyPress={(event) => handleKeyPress(index, event)}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete={index === 0 ? 'sms-otp' : 'off'}
                  maxLength={index === 0 ? OTP_LENGTH : 1}
                  editable={!loading}
                  selectTextOnFocus
                  style={[styles.otpBox, error && styles.otpBoxError]}
                />
              ))}
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              accessibilityRole="button"
              disabled={loading || code.length !== OTP_LENGTH}
              onPress={() => verify(code)}
              style={({ pressed }) => [
                styles.button,
                (loading || code.length !== OTP_LENGTH) && styles.buttonDisabled,
                pressed && code.length === OTP_LENGTH && !loading && styles.pressed,
              ]}>
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonLabel}>Verify</Text>
              )}
            </Pressable>

            <View style={styles.resendRow}>
              {secondsLeft > 0 ? (
                <Text style={styles.resendMuted}>Resend code in {secondsLeft}s</Text>
              ) : (
                <Pressable accessibilityRole="button" disabled={loading} onPress={resend}>
                  <Text style={styles.resendAction}>Resend OTP</Text>
                </Pressable>
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
  phoneHighlight: {
    fontWeight: typography.weights.semibold,
    color: colors.heading,
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
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  otpBox: {
    flex: 1,
    minHeight: spacing.input,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    backgroundColor: colors.white,
    textAlign: 'center',
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.headingSm,
    lineHeight: typography.lineHeights.headingSm,
    fontWeight: typography.weights.semibold,
    color: colors.heading,
    paddingVertical: 0,
  },
  otpBoxError: {
    borderColor: colors.error,
  },
  errorText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
    color: colors.error,
    textAlign: 'center',
  },
  button: {
    height: spacing.input,
    borderRadius: 9999,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
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
  resendRow: {
    alignItems: 'center',
    paddingTop: spacing.xs,
  },
  resendMuted: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.regular,
    color: colors.textMuted,
  },
  resendAction: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
});
