import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
  updateShopAccountPassword,
  updateShopAccountProfile,
} from '@/lib/dashboard-api';

const logo = require('@/assets/images/login/logo.png');
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WEAK_PASSWORD_COPY =
  'Use at least 8 characters with an uppercase letter, a lowercase letter, a number, and a special character.';

function apiCode(error: unknown): string | null {
  return error instanceof DashboardApiError ? error.code : null;
}

export default function AccountScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [initialName, setInitialName] = useState('');
  const [initialEmail, setInitialEmail] = useState('');
  const [phone, setPhone] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPasswordError, setCurrentPasswordError] = useState<string | null>(null);
  const [newPasswordError, setNewPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [passwordFormError, setPasswordFormError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const [phoneOpen, setPhoneOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [savedBody, setSavedBody] = useState('Your account was updated.');
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const profileDirty = name.trim() !== initialName.trim() || email.trim() !== initialEmail.trim();
  const passwordDirty = Boolean(currentPassword || newPassword || confirmPassword);
  const busy = savingProfile || savingPassword;

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
      const nextName = profile.name ?? '';
      const nextEmail = profile.email ?? '';
      setName(nextName);
      setEmail(nextEmail);
      setInitialName(nextName);
      setInitialEmail(nextEmail);
      setPhone(profile.phone);
      setNameError(null);
      setEmailError(null);
      setProfileError(null);
      setLoaded(true);
    } catch (error) {
      setLoadError(
        error instanceof DashboardApiError
          ? error.message
          : 'Could not load your account.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function showSaved(body: string) {
    setSavedBody(body);
    setSavedOpen(true);
    savedTimer.current = setTimeout(() => {
      router.back();
    }, 1400);
  }

  async function saveProfile() {
    if (busy) return;

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    let blocked = false;

    if (!trimmedName) {
      setNameError('Name is required');
      blocked = true;
    } else {
      setNameError(null);
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setEmailError('Enter a valid email address.');
      blocked = true;
    } else {
      setEmailError(null);
    }

    if (blocked || !profileDirty) return;

    setSavingProfile(true);
    setProfileError(null);

    try {
      await updateShopAccountProfile({ name: trimmedName, email: trimmedEmail });
      showSaved('Your name and email were updated.');
    } catch (error) {
      const code = apiCode(error);
      if (code === 'INVALID_ACCOUNT') {
        setNameError('Name is required');
        return;
      }
      setProfileError(
        error instanceof DashboardApiError
          ? error.message
          : 'Could not update your account.',
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword() {
    if (busy) return;

    const current = currentPassword.trim();
    const next = newPassword;
    const confirm = confirmPassword;
    let blocked = false;

    setCurrentPasswordError(null);
    setNewPasswordError(null);
    setConfirmPasswordError(null);
    setPasswordFormError(null);

    if (!current) {
      setCurrentPasswordError('Enter your current password.');
      blocked = true;
    }
    if (!next) {
      setNewPasswordError('Enter a new password.');
      blocked = true;
    }
    if (!confirm) {
      setConfirmPasswordError('Confirm your new password.');
      blocked = true;
    }
    if (next && confirm && next !== confirm) {
      setNewPasswordError('New password and confirmation do not match.');
      setConfirmPasswordError('New password and confirmation do not match.');
      blocked = true;
    }
    if (blocked) return;

    setSavingPassword(true);

    try {
      await updateShopAccountPassword({
        currentPassword: current,
        newPassword: next,
        confirmPassword: confirm,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showSaved('Your password was updated.');
    } catch (error) {
      const code = apiCode(error);
      if (code === 'INVALID_CREDENTIALS') {
        setCurrentPasswordError('That password is incorrect. Your password was not changed.');
        return;
      }
      if (code === 'PASSWORD_MISMATCH') {
        setNewPasswordError('New password and confirmation do not match.');
        setConfirmPasswordError('New password and confirmation do not match.');
        return;
      }
      if (code === 'MISSING_PASSWORD') {
        if (!current) setCurrentPasswordError('Enter your current password.');
        if (!next) setNewPasswordError('Enter a new password.');
        if (!confirm) setConfirmPasswordError('Confirm your new password.');
        if (current && next && confirm) {
          setPasswordFormError('Enter your current password and new password twice.');
        }
        return;
      }
      if (code === 'WEAK_PASSWORD') {
        setNewPasswordError(WEAK_PASSWORD_COPY);
        return;
      }
      if (code === 'NO_PASSWORD') {
        setPasswordFormError(
          "Password login isn't set up on this account — contact support.",
        );
        return;
      }
      if (code === 'AUTH_RATE_LIMIT_EXCEEDED') {
        setPasswordFormError('Too many attempts. Try again in a few minutes.');
        return;
      }
      setPasswordFormError(
        error instanceof DashboardApiError
          ? error.message
          : 'Could not update your password.',
      );
    } finally {
      setSavingPassword(false);
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
          <Text style={styles.headerTitle}>Profile</Text>
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
            <Text style={styles.heroTitle}>Your account</Text>
            <Text style={styles.heroBody}>
              Update the name and email we use to reach you. Your phone number is locked because
              it is your login identity.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                value={name}
                onChangeText={(value) => {
                  setName(value);
                  if (nameError) setNameError(null);
                  setProfileError(null);
                }}
                placeholder="Enter your name"
                placeholderTextColor={colors.textMuted}
                editable={!busy}
                style={[styles.input, nameError && styles.inputError]}
              />
              {nameError ? <Text style={styles.inlineError}>{nameError}</Text> : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  if (emailError) setEmailError(null);
                  setProfileError(null);
                }}
                placeholder="Enter your email"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                editable={!busy}
                style={[styles.input, emailError && styles.inputError]}
              />
              {emailError ? <Text style={styles.inlineError}>{emailError}</Text> : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Phone Number</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Phone number is locked"
                onPress={() => setPhoneOpen(true)}
                style={styles.phoneDisplay}>
                <Text style={styles.phoneText}>{phone?.trim() ? phone : '—'}</Text>
                <Text style={styles.lockedText}>Locked</Text>
              </Pressable>
            </View>
          </View>

          {profileError ? <Text style={styles.submitError}>{profileError}</Text> : null}

          <Pressable
            accessibilityRole="button"
            disabled={!profileDirty || busy}
            onPress={saveProfile}
            style={({ pressed }) => [
              styles.continueButton,
              (!profileDirty || busy) && styles.continueDisabled,
              pressed && profileDirty && !busy && styles.pressed,
            ]}>
            {savingProfile ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.continueText}>Save</Text>
            )}
          </Pressable>

          <View style={styles.passwordCard}>
            <Text style={styles.passwordTitle}>Change your password</Text>
            <View style={styles.field}>
              <Text style={styles.label}>Current password</Text>
              <TextInput
                value={currentPassword}
                onChangeText={(value) => {
                  setCurrentPassword(value);
                  if (currentPasswordError) setCurrentPasswordError(null);
                  setPasswordFormError(null);
                }}
                placeholder="Current password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                autoComplete="password"
                editable={!busy}
                style={[styles.input, currentPasswordError && styles.inputError]}
              />
              {currentPasswordError ? (
                <Text style={styles.inlineError}>{currentPasswordError}</Text>
              ) : null}
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>New password</Text>
              <TextInput
                value={newPassword}
                onChangeText={(value) => {
                  setNewPassword(value);
                  if (newPasswordError) setNewPasswordError(null);
                  setPasswordFormError(null);
                }}
                placeholder="New password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                editable={!busy}
                style={[styles.input, newPasswordError && styles.inputError]}
              />
              {newPasswordError ? (
                <Text style={styles.inlineError}>{newPasswordError}</Text>
              ) : null}
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Confirm new password</Text>
              <TextInput
                value={confirmPassword}
                onChangeText={(value) => {
                  setConfirmPassword(value);
                  if (confirmPasswordError) setConfirmPasswordError(null);
                  setPasswordFormError(null);
                }}
                placeholder="Confirm new password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                editable={!busy}
                style={[styles.input, confirmPasswordError && styles.inputError]}
              />
              {confirmPasswordError ? (
                <Text style={styles.inlineError}>{confirmPasswordError}</Text>
              ) : null}
            </View>
            {passwordFormError ? (
              <Text style={styles.submitError}>{passwordFormError}</Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={!passwordDirty || busy}
              onPress={savePassword}
              style={({ pressed }) => [
                styles.continueButton,
                styles.passwordSave,
                (!passwordDirty || busy) && styles.continueDisabled,
                pressed && passwordDirty && !busy && styles.pressed,
              ]}>
              {savingPassword ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.continueText}>Update password</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={phoneOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPhoneOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismiss} onPress={() => setPhoneOpen(false)} />
          <View style={styles.confirmSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.confirmTitle}>Phone number is locked</Text>
            <Text style={styles.confirmBody}>
              This number was verified at signup and is your login identity. It cannot be changed
              here, so account recovery stays tied to the same phone.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setPhoneOpen(false)}
              style={({ pressed }) => [styles.continueButton, styles.sheetButton, pressed && styles.pressed]}>
              <Text style={styles.continueText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={savedOpen} transparent animationType="fade">
        <View style={styles.savedBackdrop}>
          <View style={styles.savedCard}>
            <Text style={styles.savedTitle}>Saved</Text>
            <Text style={styles.savedBody}>{savedBody}</Text>
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
  inputError: {
    borderColor: colors.error,
  },
  inlineError: {
    marginLeft: spacing.xs,
    color: colors.error,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
  },
  phoneDisplay: {
    height: spacing.input,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.tintSoft,
    flexDirection: 'row',
    alignItems: 'center',
  },
  phoneText: {
    flex: 1,
    color: colors.heading,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
  },
  lockedText: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    fontWeight: typography.weights.semibold,
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
    backgroundColor: colors.primary,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  passwordSave: {
    marginTop: spacing.lg,
  },
  sheetButton: {
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
  passwordCard: {
    marginTop: spacing.section,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  passwordTitle: {
    marginHorizontal: spacing.screen,
    color: colors.heading,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.headingSm,
    lineHeight: typography.lineHeights.headingSm,
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
  confirmTitle: {
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
