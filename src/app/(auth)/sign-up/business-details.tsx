import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { getAuth } from '@react-native-firebase/auth';
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

import { colors, spacing, typography } from '@/constants/theme';
import { saveShopBusinessDetails } from '@/lib/auth-api';
import { useLocationPicker } from '@/lib/location-picker-context';
import { getSessionToken } from '@/lib/session';

const logo = require('@/assets/images/login/logo.png');
const blobBottom = require('@/assets/images/login/blob-bottom.png');

const SHOP_TYPES = [
  'Food & Restaurants',
  'Grocery & Supermarket',
  'Meat & Seafood',
  'Fashion & Clothing',
  'Electronics & Electrical',
  'Home & Kitchen',
  'Hardware & Tools',
  'Beauty & Personal Care',
  'Sports & Fitness',
  'Books & Stationery',
  'Automotive',
  'Baby & Kids',
  'Pet Supplies',
  'Gifts, Flowers & Accessories',
  'Other / General Retail',
] as const;

type Coordinate = {
  latitude: number;
  longitude: number;
};

export default function SignUpBusinessDetailsScreen() {
  const { message } = useLocalSearchParams<{ message?: string }>();
  const routeMessage =
    typeof message === 'string' ? message : Array.isArray(message) ? message[0] : null;
  const [shopName, setShopName] = useState('');
  const [shopType, setShopType] = useState('');
  const [address, setAddress] = useState('');
  const [location, setLocation] = useState<Coordinate | null>(null);
  const [typeModalVisible, setTypeModalVisible] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { pendingResult, clearResult } = useLocationPicker();
  const scrollRef = useRef<ScrollView>(null);

  const verifiedPhone = getAuth().currentUser?.phoneNumber ?? 'Verified mobile number';
  const canSubmit = Boolean(shopName.trim() && shopType && address.trim() && location && !submitting);

  useEffect(() => {
    if (!pendingResult) return;
    setLocation({
      latitude: pendingResult.latitude,
      longitude: pendingResult.longitude,
    });
    setAddress(pendingResult.address);
    clearResult();
  }, [clearResult, pendingResult]);

  async function submit() {
    if (!canSubmit || !location) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Your session expired. Please verify your phone again.');

      await saveShopBusinessDetails(
        {
          shopName: shopName.trim(),
          shopType,
          address,
          location: {
            lat: location.latitude,
            lng: location.longitude,
          },
        },
        token,
      );
      router.replace('/(auth)/sign-up/documents');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not save your details.');
    } finally {
      setSubmitting(false);
    }
  }

  function openLocationPicker() {
    router.push({
      pathname: '/(auth)/sign-up/location-picker',
      params: {
        initialAddress: address,
        initialLatitude: location?.latitude.toString() ?? '',
        initialLongitude: location?.longitude.toString() ?? '',
      },
    });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Image source={blobBottom} style={styles.blobBottom} contentFit="contain" pointerEvents="none" />

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
          <Text style={styles.headerTitle}>Sign Up</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          style={styles.formScroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.progress}>
            <View style={styles.progressLine} />
            {(['1', '2', '3'] as const).map((step, index) => {
              const active = index === 0;
              const label = ['Business', 'Documents', 'Review'][index];
              return (
                <View key={step} style={styles.progressStep}>
                  <View style={[styles.progressCircle, active && styles.progressCircleActive]}>
                    <Text style={[styles.progressNumber, active && styles.progressNumberActive]}>
                      {step}
                    </Text>
                  </View>
                  <Text style={[styles.progressLabel, active && styles.progressLabelActive]}>
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={styles.hero}>
            <Text style={styles.heroTitle}>Let&apos;s set up your shop</Text>
            <Text style={styles.heroBody}>
              Provide your official business information to start receiving and managing pickup
              orders.
            </Text>
          </View>

          {routeMessage ? <Text style={styles.routeMessage}>{routeMessage}</Text> : null}

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Shop Name</Text>
              <TextInput
                value={shopName}
                onChangeText={(value) => {
                  setShopName(value);
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
                <Text style={[styles.selectText, !shopType && styles.placeholder]}>
                  {shopType || 'Select Business Type'}
                </Text>
                <Text style={styles.chevron}>⌄</Text>
              </Pressable>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={styles.phoneDisplay}>
                <Text style={styles.phoneText}>{verifiedPhone}</Text>
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Registered Address</Text>
              <TextInput
                value={address}
                onChangeText={(value) => {
                  setAddress(value);
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
                  {location ? 'Edit Location on Map' : 'Pin Location on Map'}
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
            disabled={!canSubmit}
            onPress={submit}
            style={({ pressed }) => [
              styles.continueButton,
              !canSubmit && styles.continueDisabled,
              pressed && canSubmit && styles.pressed,
            ]}>
            {submitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Text style={styles.continueText}>Continue</Text>
                <Text style={styles.continueArrow}>→</Text>
              </>
            )}
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
              {SHOP_TYPES.map((type) => (
                <Pressable
                  key={type}
                  onPress={() => {
                    setShopType(type);
                    setTypeModalVisible(false);
                    setSubmitError(null);
                  }}
                  style={[styles.option, type === shopType && styles.optionSelected]}>
                  <Text style={[styles.optionText, type === shopType && styles.optionTextSelected]}>
                    {type}
                  </Text>
                  {type === shopType ? <Text style={styles.optionCheck}>✓</Text> : null}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
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
  blobBottom: {
    position: 'absolute',
    right: -128,
    bottom: 100,
    width: 320,
    height: 320,
    opacity: 0.3,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  progress: {
    height: 100,
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    position: 'relative',
  },
  progressLine: {
    position: 'absolute',
    top: 40,
    left: spacing.screen,
    right: spacing.screen,
    height: 2,
    backgroundColor: colors.stepperTrack,
  },
  progressStep: {
    alignItems: 'center',
    gap: spacing.xs,
    zIndex: 1,
  },
  progressCircle: {
    width: 32,
    height: 32,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.stepperTrack,
  },
  progressCircleActive: {
    backgroundColor: colors.primary,
  },
  progressNumber: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
  },
  progressNumberActive: {
    color: colors.white,
  },
  progressLabel: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
    letterSpacing: typography.letterSpacing.label,
  },
  progressLabelActive: {
    color: colors.primary,
  },
  hero: {
    marginHorizontal: spacing.screen,
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
  routeMessage: {
    marginHorizontal: spacing.screen,
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.medium,
    textAlign: 'center',
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
  continueArrow: {
    color: colors.white,
    fontSize: 22,
    lineHeight: 22,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
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
});
