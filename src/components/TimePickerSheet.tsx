import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/constants/theme';
import { formatHm12 } from '@/lib/opening-hours';

type Props = {
  visible: boolean;
  title: string;
  value: string;
  onClose: () => void;
  onConfirm: (hm: string) => void;
};

function parseHm(hm: string): { hour: number; minute: number } {
  const [h, m] = hm.split(':').map((part) => Number(part));
  return {
    hour: Number.isFinite(h) ? h : 9,
    minute: Number.isFinite(m) ? m : 0,
  };
}

function toHm(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

export function TimePickerSheet({ visible, title, value, onClose, onConfirm }: Props) {
  const initial = parseHm(value);
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);

  useEffect(() => {
    if (visible) {
      const next = parseHm(value);
      setHour(next.hour);
      setMinute(next.minute);
    }
  }, [visible, value]);

  const preview = formatHm12(toHm(hour, minute));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismiss} onPress={onClose} accessibilityLabel="Close" />
        <View style={styles.card}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.preview}>{preview}</Text>
          <View style={styles.columns}>
            <ScrollView style={styles.column} showsVerticalScrollIndicator={false}>
              {HOURS.map((h) => (
                <Pressable
                  key={h}
                  accessibilityRole="button"
                  onPress={() => setHour(h)}
                  style={[styles.option, h === hour && styles.optionSelected]}>
                  <Text style={[styles.optionText, h === hour && styles.optionTextSelected]}>
                    {String(h).padStart(2, '0')}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <ScrollView style={styles.column} showsVerticalScrollIndicator={false}>
              {MINUTES.map((m) => (
                <Pressable
                  key={m}
                  accessibilityRole="button"
                  onPress={() => setMinute(m)}
                  style={[styles.option, m === minute && styles.optionSelected]}>
                  <Text style={[styles.optionText, m === minute && styles.optionTextSelected]}>
                    {String(m).padStart(2, '0')}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => onConfirm(toHm(hour, minute))}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
            <Text style={styles.primaryLabel}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlayStatus,
  },
  dismiss: { flex: 1 },
  card: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.section,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  title: {
    fontFamily: typography.fonts.semibold,
    fontSize: typography.sizes.headingSm,
    color: colors.heading,
  },
  preview: {
    fontFamily: typography.fonts.medium,
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
  },
  columns: {
    flexDirection: 'row',
    gap: spacing.md,
    maxHeight: 220,
  },
  column: {
    flex: 1,
  },
  option: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  optionSelected: {
    backgroundColor: colors.tintSoft,
  },
  optionText: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.input,
    color: colors.heading,
  },
  optionTextSelected: {
    fontFamily: typography.fonts.semibold,
    color: colors.primary,
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
  pressed: { opacity: 0.9 },
});
