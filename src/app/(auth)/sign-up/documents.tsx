import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, typography } from '@/constants/theme';
import {
  OnboardingDocumentField,
  uploadShopOnboardingDocument,
} from '@/lib/auth-api';
import { pickImageFromCamera, pickImageFromGallery, PickedMedia } from '@/lib/pick-media';
import { getSessionToken } from '@/lib/session';

const logo = require('@/assets/images/login/logo.png');

const MAX_BYTES = 5 * 1024 * 1024;
const FSSAI_PLATE = '#FFDBD0';
const FSSAI_OVERLINE = '#7B2E12';

type CardStatus = 'idle' | 'uploading' | 'success' | 'error';

type CardState = {
  status: CardStatus;
  uri: string | null;
  message: string | null;
};

const EMPTY_CARD: CardState = { status: 'idle', uri: null, message: null };

type SourceSheet = { field: OnboardingDocumentField } | null;

function fileNameFor(field: OnboardingDocumentField, media: PickedMedia) {
  const ext = media.fileName.includes('.')
    ? media.fileName.split('.').pop()
    : media.mimeType.includes('png')
      ? 'png'
      : 'jpg';
  return `${field}.${ext}`;
}

export default function SignUpDocumentsScreen() {
  const { message } = useLocalSearchParams<{ message?: string }>();
  const routeMessage =
    typeof message === 'string' ? message : Array.isArray(message) ? message[0] : null;

  const [gst, setGst] = useState<CardState>(EMPTY_CARD);
  const [fssai, setFssai] = useState<CardState>(EMPTY_CARD);
  const [sheet, setSheet] = useState<SourceSheet>(null);

  const canContinue = gst.status === 'success' && fssai.status === 'success';

  function setCard(field: OnboardingDocumentField, next: CardState | ((current: CardState) => CardState)) {
    if (field === 'gst') {
      setGst(next);
    } else {
      setFssai(next);
    }
  }

  function openSheet(field: OnboardingDocumentField) {
    const current = field === 'gst' ? gst : fssai;
    if (current.status === 'uploading') return;
    setSheet({ field });
  }

  async function handlePick(source: 'camera' | 'gallery') {
    const field = sheet?.field;
    if (!field) return;
    setSheet(null);

    const result =
      source === 'camera'
        ? await pickImageFromCamera('document')
        : await pickImageFromGallery('document');

    if (result.status === 'cancelled') return;
    if (result.status === 'denied') {
      setCard(field, (current) => ({
        ...current,
        status: 'error',
        message: result.message,
      }));
      return;
    }

    if (result.media.fileSize !== null && result.media.fileSize > MAX_BYTES) {
      setCard(field, {
        status: 'error',
        uri: null,
        message: 'This file is larger than 5MB. Choose a smaller photo.',
      });
      return;
    }

    await uploadCard(field, result.media);
  }

  async function uploadCard(field: OnboardingDocumentField, media: PickedMedia) {
    setCard(field, {
      status: 'uploading',
      uri: media.uri,
      message: null,
    });

    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Your session expired. Please verify your phone again.');

      await uploadShopOnboardingDocument(
        field,
        {
          uri: media.uri,
          mimeType: media.mimeType,
          fileName: fileNameFor(field, media),
        },
        token,
      );

      setCard(field, {
        status: 'success',
        uri: media.uri,
        message: null,
      });
    } catch (error) {
      if (__DEV__) {
        console.error('[documents upload] failed', error);
      }
      setCard(field, {
        status: 'error',
        uri: media.uri,
        message: 'Upload failed, please try again',
      });
    }
  }

  function continueToBank() {
    if (!canContinue) return;
    router.replace('/(auth)/sign-up/bank-details');
  }

  const sheetTitle = useMemo(() => {
    if (!sheet) return 'Upload';
    return sheet.field === 'gst' ? 'Upload GST' : 'Upload FSSAI License';
  }, [sheet]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <View style={styles.headerBrand}>
          <Image source={logo} style={styles.headerLogo} contentFit="contain" />
          <Text style={styles.headerTitle}>Document Upload</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Verify Your Business</Text>
          <Text style={styles.heroBody}>
            Upload your official documents to complete your shop&apos;s registration and start
            receiving orders.
          </Text>
        </View>

        {routeMessage ? <Text style={styles.routeMessage}>{routeMessage}</Text> : null}

        <DocumentCard
          title="GST Document"
          overline="MANDATORY FOR ALL SHOPS"
          overlineColor={colors.textSecondary}
          plateColor={colors.hero}
          plateIcon="file-document-outline"
          plateIconColor={colors.white}
          emptyLabel="Tap to Upload GST"
          emptyHint="JPG or PNG (Max 5MB)"
          state={gst}
          onPress={() => openSheet('gst')}
        />

        <DocumentCard
          title="FSSAI License"
          overline="MANDATORY FOR ALL SHOPS"
          overlineColor={FSSAI_OVERLINE}
          plateColor={FSSAI_PLATE}
          plateIcon="silverware-fork-knife"
          plateIconColor={FSSAI_OVERLINE}
          emptyLabel="Tap to Upload License"
          emptyHint="JPG or PNG (Max 5MB)"
          state={fssai}
          onPress={() => openSheet('fssai')}
        />

        <View style={styles.trust}>
          <MaterialCommunityIcons name="shield-check" size={16} color={colors.primary} />
          <Text style={styles.trustText}>
            Your data is encrypted and securely stored. We only use these documents for regulatory
            compliance and identity verification.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          disabled={!canContinue}
          onPress={continueToBank}
          style={({ pressed }) => [
            styles.continueButton,
            !canContinue && styles.continueDisabled,
            pressed && canContinue && styles.pressed,
          ]}>
          <Text style={styles.continueText}>Continue</Text>
          <Text style={styles.continueArrow}>→</Text>
        </Pressable>
      </View>

      <Modal
        visible={sheet !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSheet(null)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{sheetTitle}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => handlePick('camera')}
              style={styles.option}>
              <Text style={styles.optionText}>Take Photo</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => handlePick('gallery')}
              style={styles.option}>
              <Text style={styles.optionText}>Choose from Gallery</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

type DocumentCardProps = {
  title: string;
  overline: string;
  overlineColor: string;
  plateColor: string;
  plateIcon: keyof typeof MaterialCommunityIcons.glyphMap;
  plateIconColor: string;
  emptyLabel: string;
  emptyHint: string;
  state: CardState;
  onPress: () => void;
};

function DocumentCard({
  title,
  overline,
  overlineColor,
  plateColor,
  plateIcon,
  plateIconColor,
  emptyLabel,
  emptyHint,
  state,
  onPress,
}: DocumentCardProps) {
  const busy = state.status === 'uploading';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.plate, { backgroundColor: plateColor }]}>
          <MaterialCommunityIcons name={plateIcon} size={20} color={plateIconColor} />
        </View>
        <View style={styles.cardCopy}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={[styles.cardOverline, { color: overlineColor }]}>{overline}</Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={emptyLabel}
        disabled={busy}
        onPress={onPress}
        style={({ pressed }) => [styles.well, pressed && !busy && styles.pressed]}>
        {state.status === 'uploading' ? (
          <ActivityIndicator color={colors.primary} />
        ) : state.uri && (state.status === 'success' || state.status === 'error') ? (
          <>
            <Image source={{ uri: state.uri }} style={styles.thumbnail} contentFit="cover" />
            {state.status === 'success' ? (
              <View style={styles.checkBadge}>
                <MaterialCommunityIcons name="check" size={14} color={colors.white} />
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.wellEmpty}>
            <MaterialCommunityIcons name="cloud-upload-outline" size={24} color={colors.primary} />
            <Text style={styles.wellLabel}>{emptyLabel}</Text>
            <Text style={styles.wellHint}>{emptyHint}</Text>
          </View>
        )}
      </Pressable>

      {state.status === 'error' && state.message ? (
        <View style={styles.cardError}>
          <Text style={styles.cardErrorText}>{state.message}</Text>
          <Pressable accessibilityRole="button" disabled={busy} onPress={onPress}>
            <Text style={styles.retryLabel}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
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
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  hero: {
    gap: spacing.xs,
  },
  heroTitle: {
    color: colors.heading,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.heading,
    lineHeight: typography.lineHeights.heading,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.heading,
  },
  heroBody: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
  },
  routeMessage: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.medium,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  plate: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    color: colors.heading,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.headingSm,
    lineHeight: typography.lineHeights.headingSm,
    fontWeight: typography.weights.semibold,
  },
  cardOverline: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
    letterSpacing: typography.letterSpacing.label,
  },
  well: {
    minHeight: 148,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.mapFill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wellEmpty: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  wellLabel: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.button,
    textAlign: 'center',
  },
  wellHint: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
    letterSpacing: typography.letterSpacing.label,
    textAlign: 'center',
  },
  thumbnail: {
    width: '100%',
    minHeight: 148,
    height: 148,
  },
  checkBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 9999,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardError: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardErrorText: {
    flex: 1,
    color: colors.error,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
  },
  retryLabel: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
  },
  trust: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 8,
    backgroundColor: 'rgba(219, 241, 254, 0.3)',
  },
  trustText: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
    letterSpacing: typography.letterSpacing.label,
  },
  footer: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(198, 197, 212, 0.3)',
    backgroundColor: colors.overlayHeader,
  },
  continueButton: {
    height: 52,
    borderRadius: 9999,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  continueDisabled: {
    opacity: 0.45,
  },
  continueText: {
    color: colors.white,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.button,
  },
  continueArrow: {
    color: colors.white,
    fontSize: 16,
  },
  pressed: {
    opacity: 0.9,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  modalCard: {
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
    lineHeight: typography.lineHeights.headingSm,
    fontWeight: typography.weights.semibold,
  },
  option: {
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  optionText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    lineHeight: typography.lineHeights.input,
    color: colors.heading,
  },
});
