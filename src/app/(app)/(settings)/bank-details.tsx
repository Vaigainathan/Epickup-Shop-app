import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenError, ScreenLoading } from '@/components/screen-status';
import { colors, spacing, typography } from '@/constants/theme';
import {
  DashboardApiError,
  fetchShopProfile,
  updateShopBankDetails,
  verifyShopSettingsUpi,
} from '@/lib/dashboard-api';

const logo = require('@/assets/images/login/logo.png');
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

function normalizeIfsc(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 11);
}

function normalizeUpi(value: string) {
  return value.trim().toLowerCase();
}

function apiCode(error: unknown): string | null {
  return error instanceof DashboardApiError ? error.code : null;
}

function isInvalidCredentials(error: unknown): boolean {
  return (
    error instanceof DashboardApiError &&
    error.status === 401 &&
    error.code === 'INVALID_CREDENTIALS'
  );
}

export default function BankDetailsScreen() {
  const [accountHolderName, setAccountHolderName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountEditing, setAccountEditing] = useState(false);
  const [accountNumberLast4, setAccountNumberLast4] = useState<string | null>(null);
  const [ifscCode, setIfscCode] = useState('');
  const [upiId, setUpiId] = useState('');
  const [initialUpi, setInitialUpi] = useState('');
  const [initialUpiVerified, setInitialUpiVerified] = useState(false);
  const [verifiedUpiId, setVerifiedUpiId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [verifyingUpi, setVerifyingUpi] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const normalizedIfsc = useMemo(() => normalizeIfsc(ifscCode), [ifscCode]);
  const normalizedUpi = useMemo(() => normalizeUpi(upiId), [upiId]);
  const ifscValid = IFSC_REGEX.test(normalizedIfsc);
  const accountNumberValid = accountEditing && accountNumber.length >= 8 && accountNumber.length <= 18;
  const upiReady = Boolean(
    normalizedUpi &&
      ((normalizedUpi === initialUpi && initialUpiVerified) || verifiedUpiId === normalizedUpi),
  );
  const busy = verifyingUpi || submitting;
  const canVerify = Boolean(normalizedUpi && !busy);
  const canConfirm = Boolean(
    accountHolderName.trim() &&
      bankName.trim() &&
      accountNumberValid &&
      ifscValid &&
      upiReady &&
      !busy,
  );
  const accountMask = accountNumberLast4 ? `•••• ${accountNumberLast4}` : '—';

  useEffect(() => {
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const profile = await fetchShopProfile();
      const loadedUpi = normalizeUpi(profile.upiId ?? '');
      const loadedVerified = Boolean(profile.upiVerified && loadedUpi);
      setAccountHolderName(profile.accountHolderName ?? '');
      setBankName(profile.bankName ?? '');
      setAccountNumber('');
      setAccountEditing(false);
      setAccountNumberLast4(profile.accountNumberLast4);
      setIfscCode(normalizeIfsc(profile.ifsc ?? ''));
      setUpiId(profile.upiId ?? '');
      setInitialUpi(loadedUpi);
      setInitialUpiVerified(loadedVerified);
      setVerifiedUpiId(loadedVerified ? loadedUpi : null);
      setVerificationMessage(null);
      setVerificationError(null);
      setFormError(null);
      setLoaded(true);
    } catch (error) {
      setLoadError(
        error instanceof DashboardApiError
          ? error.message
          : 'Could not load your bank details.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function clearSubmitMessages() {
    setFormError(null);
    setSubmitError(null);
  }

  function startAccountEdit() {
    setAccountEditing(true);
    setAccountNumber('');
    clearSubmitMessages();
  }

  function onUpiChange(value: string) {
    setUpiId(value);
    setVerifiedUpiId(null);
    setVerificationMessage(null);
    setVerificationError(null);
    clearSubmitMessages();
  }

  async function verifyUpi() {
    if (!canVerify) return;

    setVerifyingUpi(true);
    setVerificationError(null);
    setVerificationMessage(null);
    clearSubmitMessages();

    try {
      await verifyShopSettingsUpi(normalizedUpi);
      setVerifiedUpiId(normalizedUpi);
      setVerificationMessage('UPI ID verified successfully.');
    } catch (error) {
      setVerifiedUpiId(null);
      setVerificationError(
        error instanceof DashboardApiError
          ? error.message
          : 'Could not verify this UPI ID.',
      );
    } finally {
      setVerifyingUpi(false);
    }
  }

  function openConfirm() {
    if (!canConfirm) return;
    setCurrentPassword('');
    setPasswordError(null);
    setSubmitError(null);
    setConfirmOpen(true);
  }

  async function submitWithPassword() {
    if (submitting || !accountNumberValid || !upiReady) return;
    const password = currentPassword.trim();
    if (!password) {
      setPasswordError('Enter your current password to save these changes.');
      return;
    }

    setSubmitting(true);
    setPasswordError(null);
    setSubmitError(null);
    setFormError(null);

    try {
      await updateShopBankDetails({
        currentPassword: password,
        accountHolderName: accountHolderName.trim(),
        bankName: bankName.trim(),
        accountNumber,
        ifsc: normalizedIfsc,
        upiId: normalizedUpi,
      });
      setConfirmOpen(false);
      setCurrentPassword('');
      setSavedOpen(true);
      savedTimer.current = setTimeout(() => {
        router.back();
      }, 1400);
    } catch (error) {
      const code = apiCode(error);
      if (isInvalidCredentials(error)) {
        setPasswordError('That password is incorrect. Your changes were not saved.');
        return;
      }
      if (code === 'MISSING_PASSWORD') {
        setPasswordError('Enter your current password to save these changes.');
        return;
      }
      if (code === 'UPI_NOT_VERIFIED') {
        setConfirmOpen(false);
        setInitialUpiVerified(false);
        setVerifiedUpiId(null);
        setVerificationMessage(null);
        setVerificationError('This UPI ID is not verified. Verify it again before saving.');
        return;
      }
      if (code === 'INVALID_BANK_DETAILS') {
        setConfirmOpen(false);
        setFormError(
          'These bank details were not accepted. Check the account number, IFSC, and UPI ID.',
        );
        return;
      }
      setSubmitError(
        error instanceof DashboardApiError
          ? error.message
          : 'Could not update your bank details.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !loaded) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenLoading />
      </SafeAreaView>
    );
  }

  if (loadError && !loaded) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenError message={loadError} onRetry={load} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          disabled={busy}
          onPress={() => router.back()}
          style={styles.headerButton}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <View style={styles.headerBrand}>
          <Image source={logo} style={styles.headerLogo} contentFit="contain" />
          <Text style={styles.headerTitle}>UPI / Bank Details</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.formScroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>Payment destination</Text>
            <Text style={styles.heroBody}>
              Update the account and UPI ID used for settlements. Saving requires your current
              password. A new UPI ID must be verified before it goes live.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Account Holder Name</Text>
              <TextInput
                value={accountHolderName}
                onChangeText={(value) => {
                  setAccountHolderName(value);
                  clearSubmitMessages();
                }}
                placeholder="As per bank records"
                placeholderTextColor={colors.textMuted}
                editable={!busy}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Bank Name</Text>
              <TextInput
                value={bankName}
                onChangeText={(value) => {
                  setBankName(value);
                  clearSubmitMessages();
                }}
                placeholder="Enter bank name"
                placeholderTextColor={colors.textMuted}
                editable={!busy}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Account Number</Text>
              {accountEditing ? (
                <>
                  <TextInput
                    value={accountNumber}
                    onChangeText={(value) => {
                      setAccountNumber(value.replace(/\D/g, '').slice(0, 18));
                      clearSubmitMessages();
                    }}
                    placeholder="Enter full account number"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    secureTextEntry
                    editable={!busy}
                    style={[
                      styles.input,
                      accountNumber.length > 0 && !accountNumberValid && styles.inputError,
                    ]}
                  />
                  {accountNumber.length > 0 && !accountNumberValid ? (
                    <Text style={styles.errorText}>Enter 8 to 18 digits.</Text>
                  ) : (
                    <Text style={styles.helperText}>
                      The full account number is required on every save.
                    </Text>
                  )}
                </>
              ) : (
                <View style={styles.maskRow}>
                  <View style={styles.maskDisplay}>
                    <Text style={styles.maskText}>{accountMask}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Edit account number"
                    disabled={busy}
                    onPress={startAccountEdit}
                    style={({ pressed }) => [
                      styles.editButton,
                      pressed && !busy && styles.pressed,
                    ]}>
                    <Text style={styles.editLabel}>Edit</Text>
                  </Pressable>
                </View>
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>IFSC Code</Text>
              <TextInput
                value={ifscCode}
                onChangeText={(value) => {
                  setIfscCode(normalizeIfsc(value));
                  clearSubmitMessages();
                }}
                placeholder="11 CHARACTER CODE"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
                maxLength={11}
                editable={!busy}
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
                  onChangeText={onUpiChange}
                  placeholder="Enter your UPI ID"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  editable={!busy}
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
              {upiReady && !verificationError ? (
                <Text style={styles.successText}>
                  {verificationMessage ?? 'UPI ID verified.'}
                </Text>
              ) : null}
              {verificationError ? <Text style={styles.errorText}>{verificationError}</Text> : null}
            </View>
          </View>

          <View style={styles.trust}>
            <Text style={styles.trustIcon}>♢</Text>
            <View style={styles.trustCopy}>
              <Text style={styles.trustTitle}>Privacy Guaranteed</Text>
              <Text style={styles.trustText}>
                Your bank details are encrypted and used only for automated settlement of your
                earnings.
              </Text>
            </View>
          </View>

          {formError ? <Text style={styles.submitError}>{formError}</Text> : null}

          <Pressable
            accessibilityRole="button"
            disabled={!canConfirm}
            onPress={openConfirm}
            style={({ pressed }) => [
              styles.continueButton,
              !canConfirm && styles.continueDisabled,
              pressed && canConfirm && styles.pressed,
            ]}>
            <Text style={styles.continueText}>Confirm Changes</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={confirmOpen}
        transparent
        animationType="slide"
        onRequestClose={() => !submitting && setConfirmOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable
            style={styles.modalDismiss}
            onPress={() => !submitting && setConfirmOpen(false)}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.confirmSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Confirm Changes</Text>
            <Text style={styles.confirmBody}>
              Enter your current password to save these bank details.
            </Text>
            <TextInput
              value={currentPassword}
              onChangeText={(value) => {
                setCurrentPassword(value);
                if (passwordError) setPasswordError(null);
                if (submitError) setSubmitError(null);
              }}
              placeholder="Current password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoComplete="password"
              editable={!submitting}
              style={[styles.input, styles.passwordInput, passwordError && styles.inputError]}
            />
            {passwordError ? <Text style={styles.inlineError}>{passwordError}</Text> : null}
            {submitError ? <Text style={styles.inlineError}>{submitError}</Text> : null}
            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              onPress={submitWithPassword}
              style={({ pressed }) => [
                styles.continueButton,
                styles.confirmSave,
                submitting && styles.continueDisabled,
                pressed && !submitting && styles.pressed,
              ]}>
              {submitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.continueText}>Save</Text>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              onPress={() => setConfirmOpen(false)}
              style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}>
              <Text style={styles.cancelLabel}>Cancel</Text>
            </Pressable>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={savedOpen} transparent animationType="fade">
        <View style={styles.savedBackdrop}>
          <View style={styles.savedCard}>
            <Text style={styles.savedTitle}>Saved</Text>
            <Text style={styles.savedBody}>Your bank details were updated.</Text>
          </View>
        </View>
      </Modal>
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
  formScroll: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    gap: spacing.md,
    backgroundColor: colors.overlayHeader,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.tintSoft,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    color: colors.heading,
    fontSize: 34,
    lineHeight: 36,
    fontWeight: typography.weights.regular,
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
    paddingBottom: spacing.xxl,
  },
  hero: {
    marginHorizontal: spacing.screen,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
    padding: spacing.lg,
    borderRadius: 12,
    backgroundColor: colors.hero,
    overflow: 'hidden',
  },
  heroTitle: {
    color: colors.heroText,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.headingSm,
    lineHeight: typography.lineHeights.headingSm,
    fontWeight: typography.weights.semibold,
  },
  heroBody: {
    marginTop: spacing.sm,
    color: colors.overlayHeroText,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
  },
  form: {
    gap: spacing.lg,
  },
  field: {
    marginHorizontal: spacing.screen,
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
    height: spacing.input,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.white,
    color: colors.heading,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
  },
  passwordInput: {
    marginTop: spacing.md,
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
  maskRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  maskDisplay: {
    flex: 1,
    height: spacing.input,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.tintSoft,
    justifyContent: 'center',
  },
  maskText: {
    color: colors.heading,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
  },
  editButton: {
    height: spacing.input,
    minWidth: 72,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  editLabel: {
    color: colors.white,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
  },
  upiRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  upiInput: {
    flex: 1,
    height: spacing.input,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.white,
    color: colors.heading,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
  },
  verifyButton: {
    width: 88,
    height: spacing.input,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
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
  trust: {
    minHeight: 80,
    marginHorizontal: spacing.screen,
    marginTop: spacing.section,
    padding: spacing.md,
    borderRadius: 12,
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.overlayTrust,
  },
  trustIcon: {
    color: colors.success,
    fontSize: 20,
  },
  trustCopy: {
    flex: 1,
  },
  trustTitle: {
    color: colors.success,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.label,
  },
  trustText: {
    marginTop: spacing.xs,
    color: colors.success,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    letterSpacing: typography.letterSpacing.label,
    opacity: 0.8,
  },
  submitError: {
    marginHorizontal: spacing.screen,
    marginTop: spacing.md,
    color: colors.error,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    textAlign: 'center',
  },
  continueButton: {
    height: spacing.input,
    marginHorizontal: spacing.screen,
    marginTop: spacing.section,
    borderRadius: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  confirmSave: {
    marginHorizontal: 0,
    marginTop: spacing.lg,
  },
  continueDisabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.9,
  },
  continueText: {
    color: colors.white,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  modalDismiss: {
    flex: 1,
  },
  confirmSheet: {
    padding: spacing.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.surface,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    marginBottom: spacing.md,
    borderRadius: 9999,
    backgroundColor: colors.border,
  },
  modalTitle: {
    marginBottom: spacing.md,
    color: colors.heading,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.headingSm,
    fontWeight: typography.weights.semibold,
  },
  confirmBody: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
  },
  inlineError: {
    marginTop: spacing.sm,
    color: colors.error,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
  },
  cancelButton: {
    height: spacing.input,
    marginTop: spacing.sm,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLabel: {
    color: colors.heading,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
  },
  savedBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    paddingHorizontal: spacing.screen,
  },
  savedCard: {
    width: '100%',
    padding: spacing.card,
    borderRadius: 16,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  savedTitle: {
    color: colors.heading,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.headingSm,
    fontWeight: typography.weights.semibold,
    textAlign: 'center',
  },
  savedBody: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    textAlign: 'center',
  },
});
