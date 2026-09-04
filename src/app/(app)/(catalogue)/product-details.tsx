import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Href, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenError, ScreenLoading } from '@/components/screen-status';
import { colors, spacing, typography } from '@/constants/theme';
import {
  CatalogueApiError,
  deleteShopProduct,
  fetchShopCategories,
  fetchShopProduct,
  ShopProduct,
  ShopProductVariant,
  updateShopProductStock,
} from '@/lib/catalogue-api';

type StockDraft = {
  key: string;
  id?: string;
  label: string;
  unitType: string;
  stock: number;
  current: number;
};

function formatPrice(price: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: price % 1 === 0 ? 0 : 2,
  }).format(price);
}

function paramId(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function variantOptionLine(variant: ShopProductVariant): string {
  const label = variant.attributeLabel.trim();
  const value = variant.value.trim();
  if (label && value) return `${label}: ${value}`;
  return label || value || '—';
}

function draftsFromProduct(product: ShopProduct): StockDraft[] {
  if (product.hasVariants && product.variants.length > 0) {
    return product.variants.map((variant, index) => ({
      key: variant.id ?? `variant-${index}`,
      id: variant.id,
      label: variantOptionLine(variant),
      unitType: variant.unitType?.trim() || product.unitType,
      stock: variant.stock,
      current: variant.stock,
    }));
  }

  return [
    {
      key: 'simple',
      label: product.unitType,
      unitType: product.unitType,
      stock: product.stock,
      current: product.stock,
    },
  ];
}

export default function ProductDetailsScreen() {
  const { id: rawId } = useLocalSearchParams<{ id?: string | string[] }>();
  const productId = paramId(rawId);

  const [product, setProduct] = useState<ShopProduct | null>(null);
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stockOpen, setStockOpen] = useState(false);
  const [drafts, setDrafts] = useState<StockDraft[]>([]);
  const [outOfStock, setOutOfStock] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [removedOpen, setRemovedOpen] = useState(false);
  const restoreRef = useRef<number[]>([]);
  const removedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (removedTimer.current) clearTimeout(removedTimer.current);
    };
  }, []);

  const load = useCallback(async () => {
    if (!productId) {
      setProduct(null);
      setCategoryName(null);
      setError('This product could not be found.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [nextProduct, categories] = await Promise.all([
        fetchShopProduct(productId),
        fetchShopCategories(),
      ]);
      setProduct(nextProduct);
      setCategoryName(
        categories.find((category) => category.id === nextProduct.categoryId)?.name ?? null,
      );
    } catch (loadError) {
      setError(
        loadError instanceof CatalogueApiError
          ? loadError.message
          : 'Could not load this product.',
      );
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function openEdit() {
    if (!productId) return;
    router.push({
      pathname: '/(app)/(catalogue)/add-product',
      params: { id: productId },
    } as Href);
  }

  function openStock() {
    if (!product) return;
    const nextDrafts = draftsFromProduct(product);
    restoreRef.current = nextDrafts.map((draft) => draft.stock);
    setDrafts(nextDrafts);
    setOutOfStock(nextDrafts.length > 0 && nextDrafts.every((draft) => draft.stock === 0));
    setSaveError(null);
    setStockOpen(true);
  }

  function closeStock() {
    if (saving) return;
    setStockOpen(false);
    setSaveError(null);
  }

  function setOutOfStockSwitch(next: boolean) {
    if (saving) return;
    setSaveError(null);
    if (next) {
      restoreRef.current = drafts.map((draft) => draft.stock);
      setDrafts((current) => current.map((draft) => ({ ...draft, stock: 0 })));
      setOutOfStock(true);
      return;
    }
    setDrafts((current) =>
      current.map((draft, index) => ({
        ...draft,
        stock: restoreRef.current[index] ?? draft.stock,
      })),
    );
    setOutOfStock(false);
  }

  function bumpStock(index: number, delta: number) {
    if (saving) return;
    setSaveError(null);
    setDrafts((current) =>
      current.map((draft, draftIndex) => {
        if (draftIndex !== index) return draft;
        return { ...draft, stock: Math.max(0, draft.stock + delta) };
      }),
    );
    if (delta > 0) setOutOfStock(false);
  }

  async function saveStock() {
    if (!productId || !product) return;

    let input;
    if (product.hasVariants && product.variants.length > 0) {
      const variants = drafts
        .filter((draft) => Boolean(draft.id))
        .map((draft) => ({ id: draft.id as string, stock: draft.stock }));
      if (variants.length === 0) {
        setSaveError('Could not update stock.');
        return;
      }
      input = { variants };
    } else {
      input = { stock: drafts[0]?.stock ?? 0 };
    }

    setSaving(true);
    setSaveError(null);
    try {
      await updateShopProductStock(productId, input);
      setStockOpen(false);
      await load();
    } catch (stockError) {
      setSaveError(
        stockError instanceof CatalogueApiError
          ? stockError.message
          : 'Could not update stock.',
      );
    } finally {
      setSaving(false);
    }
  }

  function openDelete() {
    if (deleting || saving) return;
    setDeleteError(null);
    setDeleteOpen(true);
  }

  function closeDelete() {
    if (deleting) return;
    setDeleteOpen(false);
    setDeleteError(null);
  }

  async function confirmDelete() {
    if (!productId || deleting) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      await deleteShopProduct(productId);
      setDeleteOpen(false);
      setRemovedOpen(true);
      removedTimer.current = setTimeout(() => {
        router.back();
      }, 1400);
    } catch (removeError) {
      setDeleteError(
        removeError instanceof CatalogueApiError
          ? removeError.message
          : 'Could not delete this product.',
      );
    } finally {
      setDeleting(false);
    }
  }

  if (loading && !product) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header />
        <ScreenLoading />
      </SafeAreaView>
    );
  }

  if (error && !product) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header />
        <ScreenError message={error} onRetry={load} />
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header />
        <ScreenError message="This product could not be found." onRetry={load} />
      </SafeAreaView>
    );
  }

  const description = product.description?.trim() ? product.description.trim() : '—';

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {product.photoUrl ? (
            <Image source={{ uri: product.photoUrl }} style={styles.heroImage} contentFit="cover" />
          ) : (
            <View style={styles.heroFallback} />
          )}
          <View style={[styles.stockPill, !product.isActive && styles.stockPillOut]}>
            <Text style={[styles.stockText, !product.isActive && styles.stockTextOut]}>
              {product.isActive ? 'In Stock' : 'Out of Stock'}
            </Text>
          </View>
        </View>

        <Text style={styles.name}>{product.name}</Text>
        <Text style={styles.price}>
          {formatPrice(product.price)} / {product.unitType}
        </Text>
        <Text style={styles.description}>{description}</Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Category</Text>
          <Text style={styles.cardValue}>{categoryName ?? '—'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Inventory</Text>
          {product.hasVariants && product.variants.length > 0 ? (
            <View style={styles.variantList}>
              <Text style={styles.totalStock}>
                Total stock:{' '}
                {product.variants.reduce((sum, variant) => sum + (variant.stock ?? 0), 0)}
              </Text>
              {product.variants.map((variant, index) => (
                <View key={variant.id ?? `variant-${index}`} style={styles.variantRow}>
                  <Text style={styles.variantName}>{variantOptionLine(variant)}</Text>
                  <Text style={styles.variantMeta}>Stock: {variant.stock}</Text>
                  {variant.priceOverride !== null ? (
                    <Text style={styles.variantMeta}>
                      Price: {formatPrice(variant.priceOverride)}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.cardValue}>
              {product.stock} {product.unitType}
            </Text>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={openEdit}
          style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}>
          <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.primary} />
          <Text style={styles.editLabel}>Edit</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={openStock}
          style={({ pressed }) => [styles.stockButton, pressed && styles.pressed]}>
          <MaterialCommunityIcons name="package-variant" size={18} color={colors.white} />
          <Text style={styles.stockButtonLabel}>Update Stock</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={deleting}
          onPress={openDelete}
          style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
          <MaterialCommunityIcons name="delete-outline" size={18} color={colors.error} />
          <Text style={styles.deleteLabel}>Delete</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={stockOpen}
        transparent
        animationType="slide"
        onRequestClose={closeStock}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismiss} onPress={closeStock} />
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Inventory</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                disabled={saving}
                onPress={closeStock}
                style={styles.modalClose}>
                <MaterialCommunityIcons name="close" size={20} color={colors.heading} />
              </Pressable>
            </View>

            <View style={styles.modalProduct}>
              {product.photoUrl ? (
                <Image
                  source={{ uri: product.photoUrl }}
                  style={styles.modalThumb}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.modalThumbFallback} />
              )}
              <Text style={styles.modalProductName} numberOfLines={2}>
                {product.name}
              </Text>
            </View>

            <View style={styles.switchRow}>
              <View style={styles.flex}>
                <Text style={styles.switchTitle}>Out of Stock</Text>
                <Text style={styles.switchHint}>Set quantity to zero</Text>
              </View>
              <Switch
                value={outOfStock}
                onValueChange={setOutOfStockSwitch}
                disabled={saving}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={colors.white}
                ios_backgroundColor={colors.border}
              />
            </View>

            <ScrollView
              style={styles.stepperScroll}
              contentContainerStyle={styles.stepperList}
              showsVerticalScrollIndicator={false}>
              {drafts.map((draft, index) => (
                <View key={draft.key} style={styles.stepperBlock}>
                  {product.hasVariants ? (
                    <Text style={styles.stepperLabel}>{draft.label}</Text>
                  ) : (
                    <Text style={styles.stepperLabel}>New Stock Quantity</Text>
                  )}
                  <View style={styles.stepper}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Decrease quantity"
                      disabled={saving || draft.stock <= 0}
                      onPress={() => bumpStock(index, -1)}
                      style={({ pressed }) => [
                        styles.stepperButton,
                        (saving || draft.stock <= 0) && styles.stepperDisabled,
                        pressed && styles.pressed,
                      ]}>
                      <MaterialCommunityIcons name="minus" size={18} color={colors.heading} />
                    </Pressable>
                    <Text style={styles.stepperValue}>{draft.stock}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Increase quantity"
                      disabled={saving}
                      onPress={() => bumpStock(index, 1)}
                      style={({ pressed }) => [
                        styles.stepperButton,
                        saving && styles.stepperDisabled,
                        pressed && styles.pressed,
                      ]}>
                      <MaterialCommunityIcons name="plus" size={18} color={colors.heading} />
                    </Pressable>
                  </View>
                  <Text style={styles.currentLabel}>Current: {draft.current}</Text>
                </View>
              ))}
            </ScrollView>

            {saveError ? (
              <View style={styles.banner}>
                <Text style={styles.bannerText}>{saveError}</Text>
              </View>
            ) : null}

            <View style={styles.modalFooter}>
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={closeStock}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}>
                <Text style={styles.cancelLabel}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={saveStock}
                style={({ pressed }) => [
                  styles.saveButton,
                  saving && styles.saveDisabled,
                  pressed && styles.pressed,
                ]}>
                {saving ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.saveLabel}>Save Changes</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={deleteOpen}
        transparent
        animationType="slide"
        onRequestClose={closeDelete}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismiss} onPress={closeDelete} />
          <View style={styles.confirmSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.confirmTitle}>Delete this product?</Text>
            <Text style={styles.confirmBody}>This can't be undone.</Text>
            {deleteError ? (
              <View style={styles.banner}>
                <Text style={styles.bannerText}>{deleteError}</Text>
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={deleting}
              onPress={confirmDelete}
              style={({ pressed }) => [
                styles.confirmDelete,
                deleting && styles.saveDisabled,
                pressed && !deleting && styles.pressed,
              ]}>
              {deleting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.confirmDeleteLabel}>Confirm</Text>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={deleting}
              onPress={closeDelete}
              style={({ pressed }) => [styles.confirmCancel, pressed && styles.pressed]}>
              <Text style={styles.cancelLabel}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={removedOpen} transparent animationType="fade">
        <View style={styles.savedBackdrop}>
          <View style={styles.savedCard}>
            <Text style={styles.savedTitle}>Product removed</Text>
            <Text style={styles.savedBody}>This product was deleted from your catalogue.</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => router.back()}
        style={styles.headerButton}>
        <Text style={styles.backIcon}>‹</Text>
      </Pressable>
      <Text style={styles.headerTitle}>Product Details</Text>
    </View>
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
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    gap: spacing.md,
    backgroundColor: colors.overlayHeader,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 9999,
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
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.headingSm,
    lineHeight: typography.lineHeights.headingSm,
    fontWeight: typography.weights.semibold,
    color: colors.heading,
  },
  content: {
    padding: spacing.screen,
    paddingBottom: spacing.section,
    gap: spacing.md,
  },
  hero: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.mapFill,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroFallback: {
    flex: 1,
    backgroundColor: colors.mapFill,
  },
  stockPill: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: colors.overlayTrust,
    borderRadius: 9999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  stockPillOut: {
    backgroundColor: colors.overlayPrimary,
  },
  stockText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
    letterSpacing: typography.letterSpacing.label,
    color: colors.success,
  },
  stockTextOut: {
    color: colors.error,
  },
  name: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.heading,
    lineHeight: typography.lineHeights.heading,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.heading,
    color: colors.heading,
  },
  price: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.headingSm,
    lineHeight: typography.lineHeights.headingSm,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  description: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.regular,
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: colors.mapFill,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
    letterSpacing: typography.letterSpacing.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  cardValue: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    lineHeight: typography.lineHeights.input,
    fontWeight: typography.weights.regular,
    color: colors.heading,
  },
  variantList: {
    gap: spacing.sm,
  },
  totalStock: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
    color: colors.heading,
  },
  variantRow: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  variantName: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
    color: colors.heading,
  },
  variantMeta: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.regular,
    color: colors.textSecondary,
  },
  editButton: {
    height: spacing.input,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  editLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    lineHeight: typography.lineHeights.input,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  stockButton: {
    height: spacing.input,
    borderRadius: 12,
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
  stockButtonLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    lineHeight: typography.lineHeights.input,
    fontWeight: typography.weights.semibold,
    color: colors.white,
  },
  deleteButton: {
    height: spacing.input,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  deleteLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    lineHeight: typography.lineHeights.input,
    fontWeight: typography.weights.semibold,
    color: colors.error,
  },
  pressed: {
    opacity: 0.9,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  modalDismiss: {
    flex: 1,
  },
  modalCard: {
    maxHeight: '88%',
    padding: spacing.card,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  confirmSheet: {
    padding: spacing.card,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  confirmBody: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.textSecondary,
  },
  confirmTitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.headingSm,
    lineHeight: typography.lineHeights.headingSm,
    fontWeight: typography.weights.semibold,
    color: colors.heading,
  },
  confirmCancel: {
    height: spacing.input,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDelete: {
    height: spacing.input,
    borderRadius: 12,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDeleteLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    lineHeight: typography.lineHeights.input,
    fontWeight: typography.weights.semibold,
    color: colors.white,
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
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.headingSm,
    lineHeight: typography.lineHeights.headingSm,
    fontWeight: typography.weights.semibold,
    color: colors.heading,
    textAlign: 'center',
  },
  savedBody: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 9999,
    backgroundColor: colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  modalTitle: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.headingSm,
    lineHeight: typography.lineHeights.headingSm,
    fontWeight: typography.weights.semibold,
    color: colors.heading,
  },
  modalClose: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalProduct: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  modalThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: colors.mapFill,
  },
  modalThumbFallback: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: colors.mapFill,
  },
  modalProductName: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    lineHeight: typography.lineHeights.input,
    fontWeight: typography.weights.semibold,
    color: colors.heading,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.mapFill,
    borderRadius: 12,
    padding: spacing.md,
  },
  switchTitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
    color: colors.heading,
  },
  switchHint: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    color: colors.textSecondary,
  },
  stepperScroll: {
    maxHeight: 280,
  },
  stepperList: {
    gap: spacing.md,
  },
  stepperBlock: {
    gap: spacing.sm,
  },
  stepperLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
    letterSpacing: typography.letterSpacing.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: spacing.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.background,
  },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tintSoft,
  },
  stepperDisabled: {
    opacity: 0.4,
  },
  stepperValue: {
    minWidth: 48,
    textAlign: 'center',
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.heading,
    lineHeight: typography.lineHeights.heading,
    fontWeight: typography.weights.semibold,
    color: colors.heading,
  },
  currentLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.textMuted,
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
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
    height: spacing.input,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    lineHeight: typography.lineHeights.input,
    fontWeight: typography.weights.regular,
    color: colors.textSecondary,
  },
  saveButton: {
    flex: 1,
    height: spacing.input,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveDisabled: {
    opacity: 0.45,
  },
  saveLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    lineHeight: typography.lineHeights.input,
    fontWeight: typography.weights.semibold,
    color: colors.white,
  },
});
