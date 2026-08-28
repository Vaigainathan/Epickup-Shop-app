import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/constants/theme';

type PlaceholderScreenProps = {
  title: string;
  message?: string | null;
};

export function PlaceholderScreen({ title, message }: PlaceholderScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.screen,
  },
  label: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.medium,
    color: colors.heading,
    textAlign: 'center',
  },
  message: {
    marginTop: spacing.md,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.medium,
    color: colors.primary,
    textAlign: 'center',
  },
});
