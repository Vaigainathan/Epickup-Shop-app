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
import {
  saveShopBankDetails,
  submitShopOnboarding,
  verifyShopUpi,
} from '@/lib/auth-api';
import { routeAfterAuthenticatedSession } from '@/lib/onboarding-routing';
import { getSessionToken } from '@/lib/session';

const logo = require('@/assets/images/login/logo.png');
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const INCOMPLETE_STEP_LABELS = {
  'business-details': 'Business Details',
  documents: 'Documents',
  'bank-details': 'Bank Details',
} as const;

function normalizeIfsc(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 11);
}

function normalizeUpi(value: string) {
  return value.trim().toLowerCase();
}

export default function SignUpBankDetailsScreen() {
  const { message } = useLocalSearchParams<{ message?: string }>();
  const routeMessage =
    typeof message === 'string' ? message : Array.isArray(message) ? message[0] : null;
  const [accountHolderName, setAccountHolderName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [upiId, setUpiId] = useState('');
  const [verifiedUpiId, setVerifiedUpiId] = useState<string | null>(null);
  const [verifyingUpi, setVerifyingUpi] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const normalizedIfsc = useMemo(() => normalizeIfsc(ifscCode), [ifscCode]);
  const normalizedUpi = useMemo(() => normalizeUpi(upiId), [upiId]);
  const ifscValid = IFSC_REGEX.test(normalizedIfsc);
  const accountNumberValid = accountNumber.length >= 8 && accountNumber.length <= 18;
  const upiVerified = Boolean(normalizedUpi && verifiedUpiId === normalizedUpi);
  const canVerify = Boolean(normalizedUpi && !verifyingUpi && !submitting);
  const canSubmit = Boolean(
    accountHolderName.trim() &&
      bankName.trim() &&
      accountNumberValid &&
      ifscValid &&
      upiVerified &&
      !verifyingUpi &&
      !submitting,
  );

  async function verifyUpi() {
    if (!canVerify) return;

    setVerifyingUpi(true);
    setVerificationError(null);
    setVerificationMessage(null);
    setSubmitError(null);

    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Your session expired. Please verify your phone again.');

      await verifyShopUpi(normalizedUpi, token);
      setVerifiedUpiId(normalizedUpi);
      setVerificationMessage('UPI ID verified successfully.');
    } catch (error) {
      setVerifiedUpiId(null);
      setVerificationError(error instanceof Error ? error.message : 'Could not verify this UPI ID.');
    } finally {
      setVerifyingUpi(false);
    }
  }

  async function submit() {
    if (!canSubmit) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Your session expired. Please verify your phone again.');

      try {
        await saveShopBankDetails(
          {
            accountHolderName: accountHolderName.trim(),
            bankName: bankName.trim(),
            accountNumber,
            ifsc: normalizedIfsc,
            upiId: normalizedUpi,
          },
          token,
        );
      } catch (error) {
        setSubmitError(
          error instanceof Error ? error.message : 'Could not save your bank details.',
        );
        return;
      }

      try {
        await submitShopOnboarding(token);
        router.replace('/(auth)/application-submitted');
      } catch (error) {
        await routeAfterAuthenticatedSession(token, {
          incompleteMessage: (step) =>
            `Please complete ${INCOMPLETE_STEP_LABELS[step]} first.`,
        });
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not submit your application.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          disabled={verifyingUpi || submitting}
          onPress={() => router.back()}
          style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <View style={styles.headerBrand}>
          <Image source={logo} style={styles.headerLogo} contentFit="contain" />
          <Text style={styles.headerTitle}>Bank Details</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Text style={styles.heroOverline}>VERIFICATION REQUIRED</Text>
            <Text style={styles.heroTitle}>Link your bank account</Text>
            <Text style={styles.heroBody}>
              Securely receive payments for your shop&apos;s successful deliveries and orders.
            </Text>
          </View>

          {routeMessage ? <Text style={styles.routeMessage}>{routeMessage}</Text> : null}

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Account Holder Name</Text>
              <TextInput
                value={accountHolderName}
                onChangeText={(value) => {
                  setAccountHolderName(value);
                  setSubmitError(null);
                }}
                placeholder="Enter account holder name"
                placeholderTextColor={colors.textMuted}
                editable={!verifyingUpi && !submitting}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Bank Name</Text>
              <TextInput
                value={bankName}
                onChangeText={(value) => {
                  setBankName(value);
                  setSubmitError(null);
                }}
                placeholder="Enter bank name"
                placeholderTextColor={colors.textMuted}
                editable={!verifyingUpi && !submitting}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Account Number</Text>
              <TextInput
                value={accountNumber}
                onChangeText={(value) => {
                  setAccountNumber(value.replace(/\D/g, '').slice(0, 18));
                  setSubmitError(null);
                }}
                placeholder="Enter full account number"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                secureTextEntry
                editable={!verifyingUpi && !submitting}
                style={styles.input}
              />
              {accountNumber.length > 0 && !accountNumberValid ? (
                <Text style={styles.errorText}>Enter 8 to 18 digits.</Text>
              ) : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>IFSC Code</Text>
              <TextInput
                value={ifscCode}
                onChangeText={(value) => {
                  setIfscCode(normalizeIfsc(value));
                  setSubmitError(null);
                }}
                placeholder="Enter 11-character IFSC code"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
                maxLength={11}
                editable={!verifyingUpi && !submitting}
                style={[styles.input, ifscCode.length > 0 && !ifscValid && styles.inputError]}
              />
              {ifscCode.length > 0 && !ifscValid ? (
                <Text style={styles.errorText}>Use the format ABCD0XXXXXX.</Text>
              ) : (
                <Text style={styles.helperText}>11-character bank branch code.</Text>
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>UPI ID</Text>
              <View style={styles.upiRow}>
                <TextInput
                  value={upiId}
                  onChangeText={(value) => {
                    setUpiId(value);
                    setVerifiedUpiId(null);
                    setVerificationMessage(null);
                    setVerificationError(null);
                    setSubmitError(null);
                  }}
                  placeholder="Enter your UPI ID"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  editable={!verifyingUpi && !submitting}
                  style={styles.upiInput}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={!canVerify}
                  onPress={verifyUpi}
                  style={({ pressed }) => [
                    styles.verifyButton,
                    !canVerify && styles.verifyDisabled,
                    pressed && canVerify && styles.pressed,
                  ]}>
                  {verifyingUpi ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Text style={styles.verifyText}>Verify</Text>
                  )}
                </Pressable>
              </View>
              {verificationMessage ? (
                <Text style={styles.successText}>{verificationMessage}</Text>
              ) : null}
              {verificationError ? <Text style={styles.errorText}>{verificationError}</Text> : null}
            </View>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoIcon}>
              <Text style={styles.infoIconText}>◇</Text>
            </View>
            <View style={styles.infoCopy}>
              <Text style={styles.infoTitle}>Privacy Guaranteed</Text>
              <Text style={styles.infoText}>
                Your bank details are encrypted and used only for automated settlement of your
                earnings.
              </Text>
            </View>
          </View>

          {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}

          <Pressable
            accessibilityRole="button"
            disabled={!canSubmit}
            onPress={submit}
            style={({ pressed }) => [
              styles.submitButton,
              !canSubmit && styles.submitDisabled,
              pressed && canSubmit && styles.pressed,
            ]}>
            {submitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Text style={styles.submitText}>Submit Application</Text>
                <Text style={styles.submitArrow}>▷</Text>
              </>
            )}
          </Pressable>
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
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.screen,
    backgroundColor: colors.overlayHeader,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.tintSoft,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    color: colors.heading,
    fontSize: 34,
    lineHeight: 36,
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerLogo: {
    width: 24,
    height: 24,
  },
  headerTitle: {
    color: colors.heading,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.headingSm,
    lineHeight: typography.lineHeights.headingSm,
    fontWeight: typography.weights.semibold,
  },
  scrollContent: {
    padding: spacing.screen,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  hero: {
    padding: spacing.lg,
    borderRadius: 12,
    backgroundColor: colors.hero,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  heroOverline: {
    color: colors.heroText,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
    letterSpacing: typography.letterSpacing.label,
  },
  heroTitle: {
    marginTop: spacing.sm,
    color: colors.heroText,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.headingSm,
    lineHeight: typography.lineHeights.headingSm,
    fontWeight: typography.weights.semibold,
  },
  heroBody: {
    marginTop: spacing.xs,
    maxWidth: 280,
    color: colors.overlayHeroText,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
  },
  form: {
    gap: spacing.md,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    marginLeft: spacing.xs,
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
    letterSpacing: typography.letterSpacing.label,
  },
  input: {
    height: 48,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.white,
    color: colors.heading,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
  },
  inputError: {
    borderColor: colors.error,
  },
  helperText: {
    marginLeft: spacing.xs,
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.caption,
    fontStyle: 'italic',
  },
  errorText: {
    marginLeft: spacing.xs,
    color: colors.error,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
  },
  successText: {
    marginLeft: spacing.xs,
    color: colors.success,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
  },
  upiRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  upiInput: {
    flex: 1,
    height: 48,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.white,
    color: colors.heading,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
  },
  verifyButton: {
    width: 88,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.accent,
  },
  verifyDisabled: {
    opacity: 0.45,
  },
  verifyText: {
    color: colors.white,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
  },
  infoCard: {
    minHeight: 96,
    padding: spacing.md,
    borderRadius: 12,
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.overlayTrust,
  },
  infoIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    backgroundColor: colors.accentSoft,
  },
  infoIconText: {
    color: colors.success,
    fontSize: 24,
  },
  infoCopy: {
    flex: 1,
  },
  infoTitle: {
    color: colors.success,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.label,
  },
  infoText: {
    marginTop: spacing.xs,
    color: colors.success,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    letterSpacing: typography.letterSpacing.label,
    opacity: 0.8,
  },
  submitError: {
    color: colors.error,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    textAlign: 'center',
  },
  routeMessage: {
    paddingHorizontal: spacing.sm,
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.medium,
    textAlign: 'center',
  },
  submitButton: {
    height: spacing.input,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 6,
  },
  submitDisabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.9,
  },
  submitText: {
    color: colors.white,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.button,
  },
  submitArrow: {
    color: colors.white,
    fontSize: 20,
  },
});
