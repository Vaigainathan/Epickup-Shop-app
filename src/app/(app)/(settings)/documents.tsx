import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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
import { fetchShopType } from '@/lib/auth-api';
import { pickImageFromCamera, pickImageFromGallery, PickedMedia } from '@/lib/pick-media';
import {
  fetchShopDocumentStatuses,
  isFssaiExpiryDate,
  reuploadShopDocument,
  ShopDocumentReviewStatus,
  ShopDocumentsApiError,
  ShopDocumentType,
} from '@/lib/shop-documents-api';
import { isFssaiRequiredShopType } from '@/lib/shop-types';

const logo = require('@/assets/images/login/logo.png');

const MAX_BYTES = 5 * 1024 * 1024;
const FSSAI_PLATE = '#FFDBD0';
const FSSAI_OVERLINE = '#7B2E12';

type CardUpload = {
  status: 'idle' | 'uploading' | 'error';
  uri: string | null;
  message: string | null;
};

const EMPTY_UPLOAD: CardUpload = { status: 'idle', uri: null, message: null };

type SourceSheet = { field: ShopDocumentType } | null;

function fileNameFor(field: ShopDocumentType, media: PickedMedia) {
  const ext = media.fileName.includes('.')
    ? media.fileName.split('.').pop()
    : media.mimeType.includes('png')
      ? 'png'
      : 'jpg';
  return `${field}.${ext}`;
}

function statusLabel(status: ShopDocumentReviewStatus): string {
  if (status === 'verified') return 'Verified';
  if (status === 'action_required') return 'Action Required';
  if (status === 'under_review') return 'Under Review';
  return '—';
}

function statusColor(status: ShopDocumentReviewStatus): string {
  if (status === 'verified') return colors.success;
  if (status === 'action_required') return colors.error;
  if (status === 'under_review') return colors.textSecondary;
  return colors.textMuted;
}

function statusChipBackground(status: ShopDocumentReviewStatus): string {
  if (status === 'verified') return colors.accentSoft;
  if (status === 'action_required') return 'rgba(186, 26, 26, 0.12)';
  return colors.tintSoft;
}

export default function ComplianceDocumentsScreen() {
  const [shopType, setShopType] = useState<string | null>(null);
  const [gstStatus, setGstStatus] = useState<ShopDocumentReviewStatus>(null);
  const [fssaiStatus, setFssaiStatus] = useState<ShopDocumentReviewStatus>(null);
  const [fssaiExpiry, setFssaiExpiry] = useState('');
  const [gstUpload, setGstUpload] = useState<CardUpload>(EMPTY_UPLOAD);
  const [fssaiUpload, setFssaiUpload] = useState<CardUpload>(EMPTY_UPLOAD);
  const [sheet, setSheet] = useState<SourceSheet>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fssaiRequired = shopType === null || isFssaiRequiredShopType(shopType);
  const expiryTrimmed = fssaiExpiry.trim();
  const expiryInvalid = expiryTrimmed.length > 0 && !isFssaiExpiryDate(expiryTrimmed);

  const sheetTitle = useMemo(() => {
    if (!sheet) return 'Upload';
    return sheet.field === 'gst' ? 'Re-upload GST' : 'Re-upload FSSAI License';
  }, [sheet]);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const [nextType, statuses] = await Promise.all([
        fetchShopType(),
        fetchShopDocumentStatuses(),
      ]);
      setShopType(nextType);
      setGstStatus(statuses.gstStatus);
      setFssaiStatus(statuses.fssaiStatus);
      setFssaiExpiry(statuses.fssaiExpiryDate ?? '');
    } catch (error) {
      setLoadError(
        error instanceof ShopDocumentsApiError
          ? error.message
          : 'Could not load your documents.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function setUpload(field: ShopDocumentType, next: CardUpload | ((current: CardUpload) => CardUpload)) {
    if (field === 'gst') {
      setGstUpload(next);
    } else {
      setFssaiUpload(next);
    }
  }

  function openSheet(field: ShopDocumentType) {
    if (field === 'fssai' && !fssaiRequired) return;
    if (field === 'fssai' && expiryInvalid) return;
    const current = field === 'gst' ? gstUpload : fssaiUpload;
    if (current.status === 'uploading') return;
    setSheet({ field });
  }

  async function handlePick(source: 'camera' | 'gallery') {
    const field = sheet?.field;
    if (!field) return;
    if (field === 'fssai' && (!fssaiRequired || expiryInvalid)) return;
    setSheet(null);

    const result =
      source === 'camera'
        ? await pickImageFromCamera('document')
        : await pickImageFromGallery('document');

    if (result.status === 'cancelled') return;
    if (result.status === 'denied') {
      setUpload(field, (current) => ({
        ...current,
        status: 'error',
        message: result.message,
      }));
      return;
    }

    if (result.media.fileSize !== null && result.media.fileSize > MAX_BYTES) {
      setUpload(field, {
        status: 'error',
        uri: null,
        message: 'This file is larger than 5MB. Choose a smaller photo.',
      });
      return;
    }

    await uploadCard(field, result.media);
  }

  async function uploadCard(field: ShopDocumentType, media: PickedMedia) {
    setUpload(field, {
      status: 'uploading',
      uri: media.uri,
      message: null,
    });

    try {
      await reuploadShopDocument(
        field,
        {
          uri: media.uri,
          mimeType: media.mimeType,
          fileName: fileNameFor(field, media),
        },
        field === 'fssai' && expiryTrimmed.length > 0 ? expiryTrimmed : null,
      );
      setUpload(field, { status: 'idle', uri: media.uri, message: null });
      if (field === 'gst') {
        setGstStatus('under_review');
      } else {
        setFssaiStatus('under_review');
      }
    } catch {
      setUpload(field, {
        status: 'error',
        uri: media.uri,
        message: 'Upload failed, please try again',
      });
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenLoading />
      </SafeAreaView>
    );
  }

  if (loadError) {
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
          onPress={() => router.back()}
          style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <View style={styles.headerBrand}>
          <Image source={logo} style={styles.headerLogo} contentFit="contain" />
          <Text style={styles.headerTitle}>Compliance Documents</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>GST and FSSAI</Text>
          <Text style={styles.heroBody}>
            Re-upload a document if a license changed. New files go under review.
          </Text>
        </View>

        <ComplianceCard
          title="GST Document"
          overline="MANDATORY FOR ALL SHOPS"
          overlineColor={colors.textSecondary}
          plateColor={colors.hero}
          plateIcon="file-document-outline"
          plateIconColor={colors.white}
          reviewStatus={gstStatus}
          upload={gstUpload}
          reuploadLabel="Re-upload GST"
          onReupload={() => openSheet('gst')}
        />

        <ComplianceCard
          title="FSSAI License"
          overline={
            fssaiRequired ? 'REQUIRED FOR FOOD-RELATED SHOPS' : 'NOT APPLICABLE TO YOUR BUSINESS TYPE'
          }
          overlineColor={fssaiRequired ? FSSAI_OVERLINE : colors.textMuted}
          plateColor={fssaiRequired ? FSSAI_PLATE : colors.tintSoft}
          plateIcon="silverware-fork-knife"
          plateIconColor={fssaiRequired ? FSSAI_OVERLINE : colors.textMuted}
          reviewStatus={fssaiRequired ? fssaiStatus : null}
          upload={fssaiUpload}
          reuploadLabel="Re-upload License"
          notApplicable={!fssaiRequired}
          onReupload={() => openSheet('fssai')}
          expiry={
            fssaiRequired
              ? {
                  value: fssaiExpiry,
                  invalid: expiryInvalid,
                  onChange: (value) => setFssaiExpiry(value),
                  disabled: fssaiUpload.status === 'uploading',
                }
              : null
          }
        />

        <View style={styles.trust}>
          <MaterialCommunityIcons name="shield-check" size={16} color={colors.primary} />
          <Text style={styles.trustText}>
            Your data is encrypted and securely stored. We only use these documents for regulatory
            compliance and identity verification.
          </Text>
        </View>
      </ScrollView>

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

type ComplianceCardProps = {
  title: string;
  overline: string;
  overlineColor: string;
  plateColor: string;
  plateIcon: keyof typeof MaterialCommunityIcons.glyphMap;
  plateIconColor: string;
  reviewStatus: ShopDocumentReviewStatus;
  upload: CardUpload;
  reuploadLabel: string;
  notApplicable?: boolean;
  onReupload: () => void;
  expiry?: {
    value: string;
    invalid: boolean;
    onChange: (value: string) => void;
    disabled: boolean;
  } | null;
};

function ComplianceCard({
  title,
  overline,
  overlineColor,
  plateColor,
  plateIcon,
  plateIconColor,
  reviewStatus,
  upload,
  reuploadLabel,
  notApplicable = false,
  onReupload,
  expiry,
}: ComplianceCardProps) {
  const busy = upload.status === 'uploading';
  const reuploadBlocked = Boolean(expiry?.invalid);

  return (
    <View style={[styles.card, notApplicable && styles.cardMuted]}>
      <View style={styles.cardHeader}>
        <View style={[styles.plate, { backgroundColor: plateColor }]}>
          <MaterialCommunityIcons name={plateIcon} size={20} color={plateIconColor} />
        </View>
        <View style={styles.cardCopy}>
          <Text style={[styles.cardTitle, notApplicable && styles.mutedTitle]}>{title}</Text>
          <Text style={[styles.cardOverline, { color: overlineColor }]}>{overline}</Text>
        </View>
        {!notApplicable ? (
          <View style={[styles.statusChip, { backgroundColor: statusChipBackground(reviewStatus) }]}>
            <Text style={[styles.statusChipText, { color: statusColor(reviewStatus) }]}>
              {statusLabel(reviewStatus)}
            </Text>
          </View>
        ) : null}
      </View>

      {notApplicable ? (
        <View style={[styles.well, styles.wellMuted]}>
          <Text style={styles.notApplicableLabel}>Not applicable to your business type</Text>
        </View>
      ) : (
        <>
          {expiry ? (
            <View style={styles.expiryField}>
              <Text style={styles.expiryLabel}>FSSAI expiry date (optional)</Text>
              <TextInput
                value={expiry.value}
                onChangeText={expiry.onChange}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                editable={!expiry.disabled}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.expiryInput, expiry.invalid && styles.expiryInputError]}
              />
              {expiry.invalid ? <Text style={styles.expiryHint}>Use YYYY-MM-DD</Text> : null}
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={reuploadLabel}
            disabled={busy || reuploadBlocked}
            onPress={onReupload}
            style={({ pressed }) => [
              styles.well,
              (busy || reuploadBlocked) && styles.wellDisabled,
              pressed && !busy && !reuploadBlocked && styles.pressed,
            ]}>
            {busy ? (
              <ActivityIndicator color={colors.primary} />
            ) : upload.uri ? (
              <Image source={{ uri: upload.uri }} style={styles.thumbnail} contentFit="cover" />
            ) : (
              <View style={styles.wellEmpty}>
                <MaterialCommunityIcons name="cloud-upload-outline" size={24} color={colors.primary} />
                <Text style={styles.wellLabel}>{reuploadLabel}</Text>
                <Text style={styles.wellHint}>JPG or PNG (Max 5MB)</Text>
              </View>
            )}
          </Pressable>

          {upload.status === 'error' && upload.message ? (
            <View style={styles.cardError}>
              <Text style={styles.cardErrorText}>{upload.message}</Text>
              <Pressable
                accessibilityRole="button"
                disabled={busy || reuploadBlocked}
                onPress={onReupload}>
                <Text style={styles.retryLabel}>Retry</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      )}
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
    flex: 1,
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
  cardMuted: {
    opacity: 0.7,
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
  mutedTitle: {
    color: colors.textMuted,
  },
  cardOverline: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
    letterSpacing: typography.letterSpacing.label,
  },
  statusChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    maxWidth: 120,
  },
  statusChipText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.medium,
    textTransform: 'uppercase',
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
  wellMuted: {
    backgroundColor: colors.tintSoft,
    minHeight: 80,
    paddingHorizontal: spacing.md,
  },
  wellDisabled: {
    opacity: 0.5,
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
  notApplicableLabel: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.medium,
    textAlign: 'center',
  },
  thumbnail: {
    width: '100%',
    minHeight: 148,
    height: 148,
  },
  expiryField: {
    gap: spacing.xs,
  },
  expiryLabel: {
    marginLeft: spacing.xs,
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
    letterSpacing: typography.letterSpacing.label,
  },
  expiryInput: {
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
  expiryInputError: {
    borderColor: colors.error,
  },
  expiryHint: {
    color: colors.error,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
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
