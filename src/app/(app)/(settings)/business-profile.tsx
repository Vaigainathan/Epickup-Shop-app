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
  ShopCoordinate,
  updateShopProfile,
} from '@/lib/dashboard-api';
import { useLocationPicker } from '@/lib/location-picker-context';
import { SHOP_TYPES } from '@/lib/shop-types';

const logo = require('@/assets/images/login/logo.png');

type Draft = {
  shopName: string;
  shopType: string;
  address: string;
  location: ShopCoordinate | null;
};

function sameLocation(a: ShopCoordinate | null, b: ShopCoordinate | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.latitude === b.latitude && a.longitude === b.longitude;
}

function isInvalidCredentials(error: unknown): boolean {
  return (
    error instanceof DashboardApiError &&
    error.status === 401 &&
    error.code === 'INVALID_CREDENTIALS'
  );
}

export default function BusinessProfileScreen() {
  const [draft, setDraft] = useState<Draft>({
    shopName: '',
    shopType: '',
    address: '',
    location: null,
  });
  const [initial, setInitial] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [typeModalVisible, setTypeModalVisible] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const { pendingResult, clearResult } = useLocationPicker();
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const typeOptions = useMemo(() => {
    if (draft.shopType && !(SHOP_TYPES as readonly string[]).includes(draft.shopType)) {
      return [draft.shopType, ...SHOP_TYPES];
    }
    return [...SHOP_TYPES];
  }, [draft.shopType]);

  const complete = Boolean(
    draft.shopName.trim() && draft.shopType && draft.address.trim() && draft.location && !submitting,
  );
  const dirty =
    initial !== null &&
    (draft.shopName.trim() !== initial.shopName.trim() ||
      draft.shopType !== initial.shopType ||
      draft.address.trim() !== initial.address.trim() ||
      !sameLocation(draft.location, initial.location));
  const canConfirm = complete && dirty;

  useEffect(() => {
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!pendingResult) return;
    setDraft((current) => ({
      ...current,
      location: {
        latitude: pendingResult.latitude,
        longitude: pendingResult.longitude,
      },
      address: pendingResult.address,
    }));
    setSubmitError(null);
    clearResult();
  }, [clearResult, pendingResult]);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const profile = await fetchShopProfile();
      const next: Draft = {
        shopName: profile.shopName,
        shopType: profile.shopType ?? '',
        address: profile.address ?? '',
        location: profile.location,
      };
      setPhone(profile.phone);
      setDraft(next);
      setInitial(next);
    } catch (error) {
      setLoadError(
        error instanceof DashboardApiError
          ? error.message
          : 'Could not load your business profile.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openLocationPicker() {
    router.push({
      pathname: '/(app)/(settings)/location-picker',
      params: {
        initialAddress: draft.address,
        initialLatitude: draft.location?.latitude.toString() ?? '',
        initialLongitude: draft.location?.longitude.toString() ?? '',
      },
    });
  }

  function openConfirm() {
    if (!canConfirm) return;
    setCurrentPassword('');
    setPasswordError(null);
    setSubmitError(null);
    setConfirmOpen(true);
  }

  async function submitWithPassword() {
    if (!draft.location || submitting) return;
    const password = currentPassword.trim();
    if (!password) {
      setPasswordError('Enter your current password to save these changes.');
      return;
    }

    setSubmitting(true);
    setPasswordError(null);
    setSubmitError(null);

    try {
      await updateShopProfile({
        currentPassword: password,
        shopName: draft.shopName.trim(),
        shopType: draft.shopType,
        address: draft.address.trim(),
        location: {
          lat: draft.location.latitude,
          lng: draft.location.longitude,
        },
      });
      setConfirmOpen(false);
      setCurrentPassword('');
      setSavedOpen(true);
      savedTimer.current = setTimeout(() => {
        router.back();
      }, 1400);
    } catch (error) {
      if (isInvalidCredentials(error)) {
        setPasswordError('That password is incorrect. Your changes were not saved.');
        return;
      }
      setSubmitError(
        error instanceof DashboardApiError
          ? error.message
          : 'Could not update your business profile.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !initial) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenLoading />
      </SafeAreaView>
    );
  }

  if (loadError && !initial) {
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
          disabled={submitting}
          onPress={() => router.back()}
          style={styles.headerButton}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <View style={styles.headerBrand}>
          <Image source={logo} style={styles.headerLogo} contentFit="contain" />
          <Text style={styles.headerTitle}>Business Profile</Text>
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
            <Text style={styles.heroTitle}>Shop details</Text>
            <Text style={styles.heroBody}>
              Update your shop name, category, and map pin. Saving requires your current password.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Shop Name</Text>
              <TextInput
                value={draft.shopName}
                onChangeText={(value) => {
                  setDraft((current) => ({ ...current, shopName: value }));
                  setSubmitError(null);
                }}
                placeholder="Enter your shop name"
                placeholderTextColor={colors.textMuted}
                editable={!submitting}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Business Category</Text>
              <Pressable
                accessibilityRole="button"
                disabled={submitting}
                onPress={() => setTypeModalVisible(true)}
                style={styles.select}>
                <Text style={[styles.selectText, !draft.shopType && styles.placeholder]}>
                  {draft.shopType || 'Select Business Type'}
                </Text>
                <Text style={styles.chevron}>⌄</Text>
              </Pressable>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={styles.phoneDisplay}>
                <Text style={styles.phoneText}>{phone ?? '—'}</Text>
                {phone ? <Text style={styles.verifiedText}>Verified</Text> : null}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Registered Address</Text>
              <TextInput
                value={draft.address}
                onChangeText={(value) => {
                  setDraft((current) => ({ ...current, address: value }));
                  setSubmitError(null);
                }}
                placeholder="Address will be filled after you pin your location"
                placeholderTextColor={colors.textMuted}
                editable={!submitting}
                multiline
                textAlignVertical="top"
                style={styles.addressInput}
              />
            </View>

            <View style={styles.locationSection}>
              <Pressable
                accessibilityRole="button"
                disabled={submitting}
                onPress={openLocationPicker}
                style={styles.pinButton}>
                <Text style={styles.pinIcon}>⌖</Text>
                <Text style={styles.pinButtonText}>
                  {draft.location ? 'Edit Location on Map' : 'Pin Location on Map'}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.trust}>
            <Text style={styles.trustIcon}>♢</Text>
            <Text style={styles.trustText}>
              Your data is encrypted. We only use this information to verify your business
              identity for legal compliance.
            </Text>
          </View>

          {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}

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
        visible={typeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTypeModalVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setTypeModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Business Type</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {typeOptions.map((type) => (
                <Pressable
                  key={type}
                  onPress={() => {
                    setDraft((current) => ({ ...current, shopType: type }));
                    setTypeModalVisible(false);
                    setSubmitError(null);
                  }}
                  style={[styles.option, type === draft.shopType && styles.optionSelected]}>
                  <Text
                    style={[
                      styles.optionText,
                      type === draft.shopType && styles.optionTextSelected,
                    ]}>
                    {type}
                  </Text>
                  {type === draft.shopType ? <Text style={styles.optionCheck}>✓</Text> : null}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

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
              Enter your current password to save these shop details.
            </Text>
            <TextInput
              value={currentPassword}
              onChangeText={(value) => {
                setCurrentPassword(value);
                if (passwordError) setPasswordError(null);
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
            <Text style={styles.savedBody}>Your business profile was updated.</Text>
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
  select: {
    height: spacing.input,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectText: {
    flex: 1,
    color: colors.heading,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
  },
  placeholder: {
    color: colors.textMuted,
  },
  chevron: {
    color: colors.heading,
    fontSize: 22,
    lineHeight: 22,
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
  verifiedText: {
    color: colors.success,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    fontWeight: typography.weights.semibold,
  },
  addressInput: {
    minHeight: 104,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.white,
    color: colors.heading,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    lineHeight: typography.lineHeights.input,
  },
  locationSection: {
    marginHorizontal: spacing.screen,
    gap: spacing.md,
  },
  pinButton: {
    height: spacing.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.tintSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  pinIcon: {
    color: colors.primary,
    fontSize: 22,
  },
  pinButtonText: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.button,
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
  trustText: {
    flex: 1,
    color: colors.success,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
    letterSpacing: typography.letterSpacing.label,
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
  modalCard: {
    maxHeight: '80%',
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
  option: {
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionSelected: {
    backgroundColor: colors.tintSoft,
  },
  optionText: {
    flex: 1,
    color: colors.heading,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
  },
  optionTextSelected: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  optionCheck: {
    color: colors.success,
    fontSize: 18,
    fontWeight: typography.weights.bold,
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
