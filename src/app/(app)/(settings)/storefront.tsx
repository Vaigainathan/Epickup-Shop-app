import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TimePickerSheet } from '@/components/TimePickerSheet';
import { ScreenError, ScreenLoading } from '@/components/screen-status';
import { colors, spacing, typography } from '@/constants/theme';
import {
  copyDayToAllDays,
  formatHm12,
  isOvernightOpenClose,
  isDayDraftConfigured,
  isWeekDraftComplete,
  type DayDraft,
  type WeekdayKey,
  WEEKDAY_KEYS,
  WEEKDAY_LABELS,
  weekDraftFromApi,
  weekDraftToApi,
  validateDayDraft,
} from '@/lib/opening-hours';
import {
  deleteStorefrontPhoto,
  fetchStorefront,
  storefrontErrorMessage,
  updateStorefront,
  uploadStorefrontPhoto,
} from '@/lib/storefront-api';
import {
  pickStorefrontPhotoFromCamera,
  pickStorefrontPhotoFromGallery,
} from '@/lib/pick-media';

const logo = require('@/assets/images/login/logo.png');
const TAGLINE_MAX = 60;
const HOURS_HINT =
  'Setting hours replaces the Open/Closed switch — outside these hours customers see your shop as closed.';

type TimeTarget = { day: WeekdayKey; field: 'open' | 'close' } | null;

export default function StorefrontScreen() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tagline, setTagline] = useState('');
  const [week, setWeek] = useState(() => weekDraftFromApi(null));
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [timeTarget, setTimeTarget] = useState<TimeTarget>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchStorefront();
      setTagline(data.tagline ?? '');
      setWeek(weekDraftFromApi(data.openingHours));
      setPhotoUrl(data.photoUrl ?? data.thumbUrl);
    } catch (err) {
      setLoadError(storefrontErrorMessage(err, 'Could not load storefront.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const weekComplete = isWeekDraftComplete(week);
  const mondayConfigured = isDayDraftConfigured(week.monday);
  const taglineValid = tagline.trim().length <= TAGLINE_MAX;
  const canSave = weekComplete && taglineValid && !saving && !photoBusy;

  const timeValue = useMemo(() => {
    if (!timeTarget) return '09:00';
    const day = week[timeTarget.day];
    if (day.state !== 'open') return '09:00';
    return timeTarget.field === 'open' ? day.open : day.close;
  }, [timeTarget, week]);

  function setDay(dayKey: WeekdayKey, next: DayDraft) {
    setWeek((current) => ({ ...current, [dayKey]: next }));
    setSaveError(null);
  }

  async function save() {
    if (!canSave) return;
    const apiWeek = weekDraftToApi(week);
    if (!apiWeek) {
      setSaveError('Set hours for every day before saving.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const data = await updateStorefront({ tagline: tagline.trim(), openingHours: apiWeek });
      setTagline(data.tagline ?? '');
      setWeek(weekDraftFromApi(data.openingHours));
      setPhotoUrl(data.photoUrl ?? data.thumbUrl);
    } catch (err) {
      setSaveError(storefrontErrorMessage(err, 'Could not save storefront.'));
    } finally {
      setSaving(false);
    }
  }

  async function pickPhoto(fromCamera: boolean) {
    setPhotoBusy(true);
    setSaveError(null);
    try {
      const result = fromCamera
        ? await pickStorefrontPhotoFromCamera()
        : await pickStorefrontPhotoFromGallery();
      if (result.status === 'denied') {
        setSaveError(result.message);
        return;
      }
      if (result.status !== 'picked') return;
      const data = await uploadStorefrontPhoto({
        uri: result.media.uri,
        mimeType: result.media.mimeType,
        fileName: result.media.fileName,
      });
      setPhotoUrl(data.photoUrl ?? data.thumbUrl);
    } catch (err) {
      setSaveError(storefrontErrorMessage(err, 'Could not upload photo.'));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    setPhotoBusy(true);
    setSaveError(null);
    try {
      const data = await deleteStorefrontPhoto();
      setPhotoUrl(data.photoUrl ?? data.thumbUrl);
    } catch (err) {
      setSaveError(storefrontErrorMessage(err, 'Could not remove photo.'));
    } finally {
      setPhotoBusy(false);
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
      <View style={styles.nav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={colors.heading} />
        </Pressable>
        <Image source={logo} style={styles.logo} contentFit="contain" />
        <Text style={styles.navTitle}>Storefront</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.hint}>{HOURS_HINT}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Shop photo</Text>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.photo} contentFit="cover" />
          ) : (
            <View style={styles.photoPlaceholder}>
              <MaterialCommunityIcons name="image-outline" size={32} color={colors.textMuted} />
            </View>
          )}
          <View style={styles.row}>
            <Pressable
              accessibilityRole="button"
              disabled={photoBusy}
              onPress={() => pickPhoto(false)}
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}>
              <Text style={styles.secondaryLabel}>Choose photo</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={photoBusy}
              onPress={() => pickPhoto(true)}
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}>
              <Text style={styles.secondaryLabel}>Take photo</Text>
            </Pressable>
          </View>
          {photoUrl ? (
            <Pressable
              accessibilityRole="button"
              disabled={photoBusy}
              onPress={removePhoto}
              style={({ pressed }) => [styles.textBtn, pressed && styles.pressed]}>
              <Text style={styles.removeLabel}>Remove photo</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tagline</Text>
          <TextInput
            value={tagline}
            onChangeText={(value) => {
              setTagline(value.slice(0, TAGLINE_MAX));
              setSaveError(null);
            }}
            placeholder="A short line about your shop"
            placeholderTextColor={colors.textPlaceholder}
            maxLength={TAGLINE_MAX}
            style={styles.input}
          />
          <Text style={styles.counter}>{tagline.length}/{TAGLINE_MAX}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.hoursHeader}>
            <Text style={styles.cardTitle}>Opening hours</Text>
            <Pressable
              accessibilityRole="button"
              disabled={!mondayConfigured}
              onPress={() => setWeek((current) => copyDayToAllDays(current, 'monday'))}
              style={({ pressed }) => [
                styles.copyBtn,
                !mondayConfigured && styles.copyBtnDisabled,
                pressed && mondayConfigured && styles.pressed,
              ]}>
              <Text style={[styles.copyLabel, !mondayConfigured && styles.copyLabelDisabled]}>
                Copy Monday to all
              </Text>
            </Pressable>
          </View>

          {WEEKDAY_KEYS.map((dayKey) => {
            const day = week[dayKey];
            const dayError = day.state === 'open' ? validateDayDraft(day) : null;
            const closed = day.state === 'closed';
            const openTimes = day.state === 'open' ? day : null;
            return (
              <View key={dayKey} style={styles.dayRow}>
                <Text style={styles.dayLabel}>{WEEKDAY_LABELS[dayKey]}</Text>
                <View style={styles.dayControls}>
                  <Text style={styles.closedLabel}>Closed</Text>
                  <Switch
                    value={closed}
                    onValueChange={(value) => {
                      if (value) setDay(dayKey, { state: 'closed' });
                      else setDay(dayKey, { state: 'open', open: '09:00', close: '21:00' });
                    }}
                    trackColor={{ false: colors.border, true: colors.accent }}
                    thumbColor={colors.white}
                  />
                </View>
                {!closed ? (
                  <View style={styles.timeRow}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setTimeTarget({ day: dayKey, field: 'open' })}
                      style={({ pressed }) => [styles.timeBtn, pressed && styles.pressed]}>
                      <Text style={styles.timeBtnLabel}>
                        Open {openTimes ? formatHm12(openTimes.open) : '—'}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setTimeTarget({ day: dayKey, field: 'close' })}
                      style={({ pressed }) => [styles.timeBtn, pressed && styles.pressed]}>
                      <Text style={styles.timeBtnLabel}>
                        Close {openTimes ? formatHm12(openTimes.close) : '—'}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
                {openTimes && isOvernightOpenClose(openTimes.open, openTimes.close) ? (
                  <Text style={styles.overnight}>Closes next day</Text>
                ) : null}
                {dayError ? <Text style={styles.dayError}>{dayError}</Text> : null}
                {day.state === 'unset' ? (
                  <Text style={styles.dayError}>Set hours or mark closed.</Text>
                ) : null}
              </View>
            );
          })}
        </View>

        {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={!canSave}
          onPress={save}
          style={({ pressed }) => [styles.primary, !canSave && styles.disabled, pressed && styles.pressed]}>
          {saving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryLabel}>Save storefront</Text>
          )}
        </Pressable>
      </ScrollView>

      <TimePickerSheet
        visible={timeTarget !== null}
        title={timeTarget?.field === 'close' ? 'Closing time' : 'Opening time'}
        value={timeValue}
        onClose={() => setTimeTarget(null)}
        onConfirm={(hm) => {
          if (!timeTarget) return;
          const current = week[timeTarget.day];
          if (current.state !== 'open') return;
          const next =
            timeTarget.field === 'open'
              ? { ...current, open: hm }
              : { ...current, close: hm };
          setDay(timeTarget.day, next);
          setTimeTarget(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  nav: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    gap: spacing.md,
    backgroundColor: colors.overlayHeader,
  },
  backButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 28, height: 28 },
  navTitle: {
    fontFamily: typography.fonts.semibold,
    fontSize: typography.sizes.headingSm,
    color: colors.heading,
  },
  content: {
    padding: spacing.screen,
    gap: spacing.md,
    paddingBottom: spacing.section,
  },
  hint: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.md,
  },
  cardTitle: {
    fontFamily: typography.fonts.semibold,
    fontSize: typography.sizes.body,
    color: colors.heading,
  },
  photo: {
    width: '100%',
    height: 180,
    borderRadius: 12,
  },
  photoPlaceholder: {
    height: 180,
    borderRadius: 12,
    backgroundColor: colors.tintSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  secondaryBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontFamily: typography.fonts.semibold,
    fontSize: typography.sizes.body,
    color: colors.primary,
  },
  textBtn: { minHeight: 48, justifyContent: 'center' },
  removeLabel: {
    fontFamily: typography.fonts.medium,
    fontSize: typography.sizes.body,
    color: colors.error,
  },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.input,
    color: colors.heading,
  },
  counter: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.label,
    color: colors.textMuted,
    textAlign: 'right',
  },
  hoursHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  copyBtn: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.sm },
  copyLabel: {
    fontFamily: typography.fonts.semibold,
    fontSize: typography.sizes.label,
    color: colors.primary,
  },
  copyBtnDisabled: { opacity: 0.4 },
  copyLabelDisabled: {
    color: colors.textMuted,
  },
  dayRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  dayLabel: {
    fontFamily: typography.fonts.semibold,
    fontSize: typography.sizes.body,
    color: colors.heading,
  },
  dayControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closedLabel: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
  },
  timeRow: { flexDirection: 'row', gap: spacing.sm },
  timeBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.tintSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  timeBtnLabel: {
    fontFamily: typography.fonts.medium,
    fontSize: typography.sizes.label,
    color: colors.heading,
  },
  overnight: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.label,
    color: colors.textMuted,
  },
  dayError: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.label,
    color: colors.error,
  },
  saveError: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.body,
    color: colors.error,
  },
  primary: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    fontFamily: typography.fonts.semibold,
    fontSize: typography.sizes.input,
    color: colors.white,
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.9 },
});
