import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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

import { ScreenError, ScreenLoading } from '@/components/screen-status';
import { colors, spacing, typography } from '@/constants/theme';
import {
  CatalogueApiError,
  createShopCategory,
  deleteShopCategory,
  fetchShopCategories,
  fetchShopProducts,
  ShopCategory,
  updateShopCategory,
} from '@/lib/catalogue-api';

const emptyIllustration = require('@/assets/images/catalogue/empty-categories.png');

export default function CategoriesScreen() {
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [nextCategories, nextProducts] = await Promise.all([
        fetchShopCategories(),
        fetchShopProducts(),
      ]);
      setCategories(nextCategories);
      const counts: Record<string, number> = {};
      for (const product of nextProducts) {
        if (!product.categoryId) continue;
        counts[product.categoryId] = (counts[product.categoryId] ?? 0) + 1;
      }
      setProductCounts(counts);
    } catch (loadError) {
      setError(
        loadError instanceof CatalogueApiError
          ? loadError.message
          : 'Could not load your categories.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const isEmpty = categories.length === 0;
  const formVisible = showForm || editingId !== null || !isEmpty;

  const formTitle = editingId ? 'Edit Category' : 'Create New Category';

  const canSave = useMemo(() => name.trim().length > 0 && !saving, [name, saving]);

  function resetForm() {
    setName('');
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(category: ShopCategory) {
    setBanner(null);
    setEditingId(category.id);
    setName(category.name);
    setShowForm(true);
  }

  async function saveCategory() {
    const trimmed = name.trim();
    if (!trimmed || saving) return;

    setSaving(true);
    setBanner(null);

    try {
      if (editingId) {
        const updated = await updateShopCategory(editingId, trimmed);
        setCategories((current) =>
          current.map((category) => (category.id === updated.id ? updated : category)),
        );
      } else {
        const created = await createShopCategory(trimmed);
        setCategories((current) =>
          [...current, created].sort((a, b) => a.name.localeCompare(b.name)),
        );
      }
      resetForm();
    } catch (saveError) {
      setBanner(
        saveError instanceof CatalogueApiError
          ? saveError.message
          : 'Could not save this category.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeCategory(category: ShopCategory) {
    if (deletingId) return;

    setDeletingId(category.id);
    setBanner(null);

    try {
      await deleteShopCategory(category.id);
      setCategories((current) => current.filter((item) => item.id !== category.id));
      if (editingId === category.id) {
        resetForm();
      }
    } catch (deleteError) {
      if (deleteError instanceof CatalogueApiError && deleteError.code === 'CATEGORY_IN_USE') {
        setBanner(deleteError.message);
      } else {
        setBanner(
          deleteError instanceof CatalogueApiError
            ? deleteError.message
            : 'Could not delete this category.',
        );
      }
    } finally {
      setDeletingId(null);
    }
  }

  if (loading && categories.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenLoading />
      </SafeAreaView>
    );
  }

  if (error && categories.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenError message={error} onRetry={load} />
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
        <Text style={styles.headerTitle}>Manage Categories</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          {banner ? (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>{banner}</Text>
            </View>
          ) : null}

          {formVisible ? (
            <View style={styles.form}>
              <Text style={styles.formTitle}>{formTitle}</Text>
              <Text style={styles.formBody}>
                Name your category to help customers find products faster.
              </Text>
              <Text style={styles.label}>Category Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Category name"
                placeholderTextColor={colors.textPlaceholder}
                editable={!saving}
                style={styles.input}
              />
              <View style={styles.formActions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={resetForm}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                  <Text style={styles.secondaryLabel}>Cancel</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={!canSave}
                  onPress={saveCategory}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    (!canSave || pressed) && styles.pressed,
                  ]}>
                  {saving ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.primaryLabel}>Save Category</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : null}

          {isEmpty && !formVisible ? (
            <View style={styles.empty}>
              <Image source={emptyIllustration} style={styles.emptyImage} contentFit="contain" />
              <Text style={styles.emptyTitle}>No categories yet</Text>
              <Text style={styles.emptyBody}>
                Organize your products into categories to help customers find what they need faster.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setBanner(null);
                  setShowForm(true);
                }}
                style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
                <MaterialCommunityIcons name="plus" size={14} color={colors.white} />
                <Text style={styles.ctaLabel}>Add Category</Text>
              </Pressable>
            </View>
          ) : null}

          {categories.map((category) => {
            const count = productCounts[category.id] ?? 0;
            const isDeleting = deletingId === category.id;
            return (
              <View key={category.id} style={styles.row}>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowName}>{category.name}</Text>
                  <Text style={[styles.rowCount, count === 0 && styles.rowCountEmpty]}>
                    {count} {count === 1 ? 'item' : 'items'}
                  </Text>
                </View>
                <View style={styles.rowActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${category.name}`}
                    disabled={isDeleting}
                    onPress={() => startEdit(category)}
                    style={styles.iconButton}>
                    <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.accent} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${category.name}`}
                    disabled={isDeleting}
                    onPress={() => removeCategory(category)}
                    style={styles.iconButton}>
                    {isDeleting ? (
                      <ActivityIndicator color={colors.error} size="small" />
                    ) : (
                      <MaterialCommunityIcons name="delete-outline" size={18} color={colors.error} />
                    )}
                  </Pressable>
                </View>
              </View>
            );
          })}
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
    paddingHorizontal: spacing.screen,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontFamily: typography.fontFamily,
    fontSize: 28,
    lineHeight: 32,
    color: colors.heading,
  },
  headerTitle: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.headingSm,
    lineHeight: typography.lineHeights.headingSm,
    fontWeight: typography.weights.semibold,
    color: colors.heading,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flexGrow: 1,
    padding: spacing.screen,
    gap: spacing.md,
    paddingBottom: spacing.section,
  },
  banner: {
    backgroundColor: colors.overlayPrimary,
    borderRadius: 12,
    padding: spacing.md,
  },
  bannerText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.medium,
    color: colors.error,
  },
  form: {
    gap: spacing.sm,
  },
  formTitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    lineHeight: typography.lineHeights.input,
    fontWeight: typography.weights.regular,
    color: colors.heading,
  },
  formBody: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    lineHeight: typography.lineHeights.input,
    fontWeight: typography.weights.regular,
    color: colors.textSecondary,
  },
  label: {
    marginTop: spacing.sm,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    lineHeight: typography.lineHeights.input,
    fontWeight: typography.weights.regular,
    color: colors.textSecondary,
  },
  input: {
    minHeight: spacing.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    lineHeight: typography.lineHeights.input,
    color: colors.heading,
  },
  formActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 9999,
    backgroundColor: colors.overlayPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    lineHeight: typography.lineHeights.input,
    fontWeight: typography.weights.regular,
    color: colors.primary,
  },
  primaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 9999,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    lineHeight: typography.lineHeights.input,
    fontWeight: typography.weights.regular,
    color: colors.white,
  },
  empty: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.section,
    gap: spacing.sm,
  },
  emptyImage: {
    width: 256,
    height: 256,
  },
  emptyTitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.heading,
    lineHeight: typography.lineHeights.heading,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.heading,
    color: colors.heading,
    textAlign: 'center',
  },
  emptyBody: {
    maxWidth: 280,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.regular,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  cta: {
    marginTop: spacing.md,
    height: 48,
    paddingHorizontal: spacing.xl,
    borderRadius: 9999,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ctaLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.button,
    color: colors.white,
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  rowCopy: {
    flex: 1,
    paddingRight: spacing.md,
  },
  rowName: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    lineHeight: typography.lineHeights.input,
    fontWeight: typography.weights.semibold,
    color: colors.heading,
  },
  rowCount: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    lineHeight: typography.lineHeights.input,
    fontWeight: typography.weights.regular,
    color: colors.textSecondary,
  },
  rowCountEmpty: {
    color: colors.accent,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.9,
  },
});
