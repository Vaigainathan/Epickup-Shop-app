import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Href, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenError, ScreenLoading } from '@/components/screen-status';
import { colors, spacing, typography } from '@/constants/theme';
import {
  CatalogueApiError,
  createShopProduct,
  fetchShopCategories,
  fetchShopProduct,
  PRODUCT_UNIT_TYPES,
  ShopCategory,
  ShopProduct,
  ShopProductVariant,
  updateShopProduct,
} from '@/lib/catalogue-api';
import {
  pickProductPhotoFromCamera,
  pickProductPhotoFromGallery,
  PickedMedia,
} from '@/lib/pick-media';

type VariantDraft = {
  key: string;
  id?: string;
  attributeLabel: string;
  value: string;
  stock: string;
  priceOverride: string;
  unitType: string;
};

type SelectSheet =
  | { kind: 'closed' }
  | { kind: 'category' }
  | { kind: 'unit' }
  | { kind: 'variantUnit'; key: string };

function parseMoney(value: string): number | null {
  const parsed = Number(value.replace(/,/g, '').trim());
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function parseStock(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) return null;
  return parsed;
}

function emptyVariant(key: string): VariantDraft {
  return {
    key,
    attributeLabel: '',
    value: '',
    stock: '',
    priceOverride: '',
    unitType: '',
  };
}

function variantsFromProduct(product: ShopProduct, nextKey: () => string): VariantDraft[] {
  if (!product.hasVariants || product.variants.length === 0) {
    return [emptyVariant(nextKey())];
  }
  return product.variants.map((variant) => ({
    key: variant.id ?? nextKey(),
    id: variant.id,
    attributeLabel: variant.attributeLabel,
    value: variant.value,
    stock: String(variant.stock),
    priceOverride: variant.priceOverride === null ? '' : String(variant.priceOverride),
    unitType: variant.unitType ?? '',
  }));
}

function buildVariantsPayload(drafts: VariantDraft[]): ShopProductVariant[] | null {
  const complete = drafts.filter(
    (draft) => draft.attributeLabel.trim().length > 0 && draft.value.trim().length > 0,
  );
  if (complete.length === 0) return null;

  const variants: ShopProductVariant[] = [];
  for (const draft of complete) {
    const stock = parseStock(draft.stock);
    if (stock === null) return null;
    const priceOverride =
      draft.priceOverride.trim().length === 0 ? null : parseMoney(draft.priceOverride);
    if (draft.priceOverride.trim().length > 0 && priceOverride === null) return null;
    variants.push({
      id: draft.id,
      attributeLabel: draft.attributeLabel.trim(),
      value: draft.value.trim(),
      stock,
      priceOverride,
      unitType: draft.unitType.trim().length > 0 ? draft.unitType.trim() : null,
    });
  }
  return variants;
}

export default function AddProductScreen() {
  const { id: rawId } = useLocalSearchParams<{ id?: string | string[] }>();
  const productId = Array.isArray(rawId) ? rawId[0] : rawId;
  const isEdit = Boolean(productId);

  const draftSeq = useRef(0);
  const nextKey = useCallback(() => {
    draftSeq.current += 1;
    return `variant-${draftSeq.current}`;
  }, []);

  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [unitType, setUnitType] = useState<string>('Piece');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [stock, setStock] = useState('');
  const [hasVariants, setHasVariants] = useState(false);
  const [variants, setVariants] = useState<VariantDraft[]>(() => [emptyVariant('variant-0')]);
  const [localPhoto, setLocalPhoto] = useState<PickedMedia | null>(null);
  const [remotePhotoUrl, setRemotePhotoUrl] = useState<string | null>(null);

  const [sheet, setSheet] = useState<SelectSheet>({ kind: 'closed' });
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);

  const selectedCategory = categories.find((category) => category.id === categoryId) ?? null;
  const photoUri = localPhoto?.uri ?? remotePhotoUrl;
  const parsedPrice = parseMoney(price);
  const parsedStock = parseStock(stock);

  const loadCategories = useCallback(async () => {
    const nextCategories = await fetchShopCategories();
    setCategories(nextCategories);
    return nextCategories;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const nextCategories = await loadCategories();
      if (productId) {
        const product = await fetchShopProduct(productId);
        setName(product.name);
        setDescription(product.description ?? '');
        setPrice(String(product.price));
        setUnitType(product.unitType);
        setCategoryId(
          product.categoryId && nextCategories.some((category) => category.id === product.categoryId)
            ? product.categoryId
            : null,
        );
        setIsActive(product.isActive);
        setStock(product.hasVariants ? '' : String(product.stock));
        setHasVariants(product.hasVariants);
        setVariants(variantsFromProduct(product, nextKey));
        setRemotePhotoUrl(product.photoUrl);
        setLocalPhoto(null);
      }
    } catch (error) {
      setLoadError(
        error instanceof CatalogueApiError ? error.message : 'Could not load this product form.',
      );
    } finally {
      setLoading(false);
    }
  }, [loadCategories, nextKey, productId]);

  const didInitialLoad = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!didInitialLoad.current) {
        didInitialLoad.current = true;
        load();
        return;
      }
      loadCategories().catch(() => {});
    }, [load, loadCategories]),
  );

  const canSave = useMemo(() => {
    if (saving) return false;
    if (name.trim().length === 0) return false;
    if (parsedPrice === null || price.trim().length === 0) return false;
    if (!selectedCategory) return false;
    if (hasVariants) {
      return buildVariantsPayload(variants) !== null;
    }
    return parsedStock !== null;
  }, [saving, name, parsedPrice, price, selectedCategory, hasVariants, variants, parsedStock]);

  function closeSheets() {
    setSheet({ kind: 'closed' });
    setPhotoSheetOpen(false);
  }

  function updateVariant(key: string, patch: Partial<VariantDraft>) {
    setVariants((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addVariant() {
    setVariants((current) => [...current, emptyVariant(nextKey())]);
  }

  function removeVariant(key: string) {
    setVariants((current) => {
      const next = current.filter((row) => row.key !== key);
      return next.length > 0 ? next : [emptyVariant(nextKey())];
    });
  }

  async function handlePick(source: 'gallery' | 'camera') {
    setPhotoSheetOpen(false);
    const result =
      source === 'gallery'
        ? await pickProductPhotoFromGallery()
        : await pickProductPhotoFromCamera();

    if (result.status === 'cancelled') return;
    if (result.status === 'denied') {
      setSaveError(result.message);
      return;
    }
    setSaveError(null);
    setLocalPhoto(result.media);
  }

  function removePhoto() {
    setPhotoSheetOpen(false);
    setLocalPhoto(null);
    setRemotePhotoUrl(null);
  }

  async function saveProduct() {
    if (!canSave || !selectedCategory || parsedPrice === null) return;

    const variantPayload = hasVariants ? buildVariantsPayload(variants) : [];
    if (hasVariants && variantPayload === null) return;
    if (!hasVariants && parsedStock === null) return;

    setSaving(true);
    setSaveError(null);

    const input = {
      name: name.trim(),
      description: description.trim(),
      price: parsedPrice,
      unitType,
      categoryId: selectedCategory.id,
      isActive,
      stock: hasVariants ? 0 : parsedStock ?? 0,
      hasVariants,
      variants: variantPayload ?? [],
      photo: localPhoto,
    };

    try {
      const saved = productId
        ? await updateShopProduct(productId, input)
        : await createShopProduct(input);
      if (__DEV__) {
        const confirmed = await fetchShopProduct(saved.id);
        console.log('[product]', { id: confirmed.id, photoUrl: confirmed.photoUrl });
      }
      router.back();
    } catch (error) {
      setSaveError(
        error instanceof CatalogueApiError ? error.message : 'Could not save this product.',
      );
    } finally {
      setSaving(false);
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

  const unitSheetTitle = sheet.kind === 'variantUnit' ? 'Variant unit' : 'Unit';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={styles.headerButton}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{isEdit ? 'Edit Product' : 'Add Product'}</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Upload product photo"
            disabled={saving}
            onPress={() => setPhotoSheetOpen(true)}
            style={({ pressed }) => [styles.photoTap, pressed && styles.pressed]}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photoPreview} contentFit="cover" />
            ) : (
              <View style={styles.photoEmpty}>
                <MaterialCommunityIcons
                  name="camera-plus-outline"
                  size={40}
                  color={colors.textSecondary}
                />
                <Text style={styles.photoLabel}>TAP TO UPLOAD PRODUCT PHOTO</Text>
              </View>
            )}
          </Pressable>

          <View style={styles.fields}>
            <View style={styles.field}>
              <Text style={styles.label}>Product Name</Text>
              <TextInput
                value={name}
                onChangeText={(value) => {
                  setName(value);
                  setSaveError(null);
                }}
                placeholder="Product name"
                placeholderTextColor={colors.textPlaceholder}
                editable={!saving}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Product Details</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Brief description of the product"
                placeholderTextColor={colors.textPlaceholder}
                editable={!saving}
                multiline
                textAlignVertical="top"
                style={[styles.input, styles.textarea]}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.field, styles.flex]}>
                <Text style={styles.label}>Price (₹)</Text>
                <View style={styles.priceShell}>
                  <Text style={styles.currency}>₹</Text>
                  <TextInput
                    value={price}
                    onChangeText={(value) => {
                      setPrice(value);
                      setSaveError(null);
                    }}
                    placeholder="0.00"
                    placeholderTextColor={colors.textPlaceholder}
                    keyboardType="decimal-pad"
                    editable={!saving}
                    style={styles.priceInput}
                  />
                </View>
              </View>
              <View style={[styles.field, styles.flex]}>
                <Text style={styles.label}>Category</Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={() => setSheet({ kind: 'category' })}
                  style={styles.select}>
                  <Text
                    style={[styles.selectText, !selectedCategory && styles.placeholder]}
                    numberOfLines={1}>
                    {selectedCategory?.name ?? 'Select category'}
                  </Text>
                  <MaterialCommunityIcons
                    name="chevron-down"
                    size={16}
                    color={colors.heading}
                  />
                </Pressable>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Unit</Text>
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={() => setSheet({ kind: 'unit' })}
                style={styles.select}>
                <Text style={styles.selectText}>{unitType}</Text>
                <MaterialCommunityIcons name="chevron-down" size={16} color={colors.heading} />
              </Pressable>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.flex}>
                  <Text style={styles.cardTitle}>Inventory Status</Text>
                  <Text style={styles.cardSubtitle}>Show product in the public shop</Text>
                </View>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  disabled={saving}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor={colors.white}
                  ios_backgroundColor={colors.border}
                />
              </View>
              <View style={styles.statusRow}>
                <MaterialCommunityIcons
                  name={isActive ? 'check' : 'close'}
                  size={12}
                  color={isActive ? colors.accent : colors.error}
                />
                <Text style={[styles.statusText, !isActive && styles.statusTextOff]}>
                  {isActive ? 'IN STOCK & READY' : 'OUT OF STOCK'}
                </Text>
              </View>
              {!hasVariants ? (
                <View style={styles.stockField}>
                  <Text style={styles.label}>Stock quantity</Text>
                  <TextInput
                    value={stock}
                    onChangeText={setStock}
                    placeholder="0"
                    placeholderTextColor={colors.textPlaceholder}
                    keyboardType="number-pad"
                    editable={!saving}
                    style={styles.input}
                  />
                </View>
              ) : null}
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.flex}>
                  <Text style={styles.cardTitle}>Product Variants</Text>
                  <Text style={styles.cardSubtitle}>Offer this product in multiple options</Text>
                </View>
                <Switch
                  value={hasVariants}
                  onValueChange={(value) => {
                    setHasVariants(value);
                    if (value && variants.length === 0) {
                      setVariants([emptyVariant(nextKey())]);
                    }
                  }}
                  disabled={saving}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor={colors.white}
                  ios_backgroundColor={colors.border}
                />
              </View>
              {hasVariants ? (
                <View style={styles.variantList}>
                  {variants.map((variant) => (
                    <View key={variant.key} style={styles.variantCard}>
                      <View style={styles.row}>
                        <View style={[styles.field, styles.flex]}>
                          <Text style={styles.label}>Attribute</Text>
                          <TextInput
                            value={variant.attributeLabel}
                            onChangeText={(value) =>
                              updateVariant(variant.key, { attributeLabel: value })
                            }
                            placeholder="Attribute"
                            placeholderTextColor={colors.textPlaceholder}
                            editable={!saving}
                            style={styles.input}
                          />
                        </View>
                        <View style={[styles.field, styles.flex]}>
                          <Text style={styles.label}>Value</Text>
                          <TextInput
                            value={variant.value}
                            onChangeText={(value) => updateVariant(variant.key, { value })}
                            placeholder="Value"
                            placeholderTextColor={colors.textPlaceholder}
                            editable={!saving}
                            style={styles.input}
                          />
                        </View>
                      </View>
                      <View style={styles.row}>
                        <View style={[styles.field, styles.flex]}>
                          <Text style={styles.label}>Stock</Text>
                          <TextInput
                            value={variant.stock}
                            onChangeText={(value) => updateVariant(variant.key, { stock: value })}
                            placeholder="0"
                            placeholderTextColor={colors.textPlaceholder}
                            keyboardType="number-pad"
                            editable={!saving}
                            style={styles.input}
                          />
                        </View>
                        <View style={[styles.field, styles.flex]}>
                          <Text style={styles.label}>Price override</Text>
                          <TextInput
                            value={variant.priceOverride}
                            onChangeText={(value) =>
                              updateVariant(variant.key, { priceOverride: value })
                            }
                            placeholder="Optional"
                            placeholderTextColor={colors.textPlaceholder}
                            keyboardType="decimal-pad"
                            editable={!saving}
                            style={styles.input}
                          />
                        </View>
                      </View>
                      <View style={styles.row}>
                        <View style={[styles.field, styles.flex]}>
                          <Text style={styles.label}>Unit</Text>
                          <Pressable
                            accessibilityRole="button"
                            disabled={saving}
                            onPress={() => setSheet({ kind: 'variantUnit', key: variant.key })}
                            style={styles.select}>
                            <Text
                              style={[
                                styles.selectText,
                                !variant.unitType && styles.placeholder,
                              ]}
                              numberOfLines={1}>
                              {variant.unitType || `Same as product (${unitType})`}
                            </Text>
                            <MaterialCommunityIcons
                              name="chevron-down"
                              size={16}
                              color={colors.heading}
                            />
                          </Pressable>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Remove variant"
                          disabled={saving}
                          onPress={() => removeVariant(variant.key)}
                          style={styles.removeVariant}>
                          <MaterialCommunityIcons
                            name="delete-outline"
                            size={18}
                            color={colors.error}
                          />
                        </Pressable>
                      </View>
                    </View>
                  ))}
                  <Pressable
                    accessibilityRole="button"
                    disabled={saving}
                    onPress={addVariant}
                    style={({ pressed }) => [styles.addVariant, pressed && styles.pressed]}>
                    <MaterialCommunityIcons name="plus" size={16} color={colors.primary} />
                    <Text style={styles.addVariantLabel}>Add variant</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>

          {saveError ? (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>{saveError}</Text>
            </View>
          ) : null}

          {categories.length === 0 ? (
            <Text style={styles.hint}>
              Create a category before saving a product. Use Add Category in the category list.
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={!canSave}
            onPress={saveProduct}
            style={({ pressed }) => [
              styles.saveButton,
              !canSave && styles.saveDisabled,
              pressed && canSave && styles.pressed,
            ]}>
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <MaterialCommunityIcons name="content-save-outline" size={18} color={colors.white} />
                <Text style={styles.saveLabel}>Save Product</Text>
              </>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}>
            <Text style={styles.cancelLabel}>Cancel Changes</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={sheet.kind !== 'closed'}
        transparent
        animationType="slide"
        onRequestClose={closeSheets}>
        <Pressable style={styles.modalBackdrop} onPress={closeSheets}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {sheet.kind === 'category' ? 'Category' : unitSheetTitle}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {sheet.kind === 'category' ? (
                <>
                  {categories.map((category) => (
                    <Pressable
                      key={category.id}
                      onPress={() => {
                        setCategoryId(category.id);
                        setSaveError(null);
                        closeSheets();
                      }}
                      style={[
                        styles.option,
                        category.id === categoryId && styles.optionSelected,
                      ]}>
                      <Text
                        style={[
                          styles.optionText,
                          category.id === categoryId && styles.optionTextSelected,
                        ]}>
                        {category.name}
                      </Text>
                      {category.id === categoryId ? (
                        <Text style={styles.optionCheck}>✓</Text>
                      ) : null}
                    </Pressable>
                  ))}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      closeSheets();
                      router.push('/(app)/(catalogue)/categories' as Href);
                    }}
                    style={styles.addCategoryOption}>
                    <Text style={styles.addCategoryLabel}>Add Category →</Text>
                  </Pressable>
                </>
              ) : null}

              {sheet.kind === 'unit'
                ? PRODUCT_UNIT_TYPES.map((unit) => (
                    <Pressable
                      key={unit}
                      onPress={() => {
                        setUnitType(unit);
                        closeSheets();
                      }}
                      style={[styles.option, unit === unitType && styles.optionSelected]}>
                      <Text
                        style={[
                          styles.optionText,
                          unit === unitType && styles.optionTextSelected,
                        ]}>
                        {unit}
                      </Text>
                      {unit === unitType ? <Text style={styles.optionCheck}>✓</Text> : null}
                    </Pressable>
                  ))
                : null}

              {sheet.kind === 'variantUnit' ? (
                <>
                  <Pressable
                    onPress={() => {
                      updateVariant(sheet.key, { unitType: '' });
                      closeSheets();
                    }}
                    style={[
                      styles.option,
                      !variants.find((row) => row.key === sheet.key)?.unitType &&
                        styles.optionSelected,
                    ]}>
                    <Text
                      style={[
                        styles.optionText,
                        !variants.find((row) => row.key === sheet.key)?.unitType &&
                          styles.optionTextSelected,
                      ]}>
                      Same as product ({unitType})
                    </Text>
                  </Pressable>
                  {PRODUCT_UNIT_TYPES.map((unit) => (
                    <Pressable
                      key={unit}
                      onPress={() => {
                        updateVariant(sheet.key, { unitType: unit });
                        closeSheets();
                      }}
                      style={[
                        styles.option,
                        variants.find((row) => row.key === sheet.key)?.unitType === unit &&
                          styles.optionSelected,
                      ]}>
                      <Text
                        style={[
                          styles.optionText,
                          variants.find((row) => row.key === sheet.key)?.unitType === unit &&
                            styles.optionTextSelected,
                        ]}>
                        {unit}
                      </Text>
                    </Pressable>
                  ))}
                </>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={photoSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPhotoSheetOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPhotoSheetOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Change Photo</Text>
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
            {photoUri ? (
              <Pressable accessibilityRole="button" onPress={removePhoto} style={styles.option}>
                <Text style={[styles.optionText, styles.removePhotoLabel]}>Remove</Text>
              </Pressable>
            ) : null}
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
    gap: spacing.lg,
  },
  photoTap: {
    minHeight: 176,
    borderRadius: 12,
    backgroundColor: colors.tintSoft,
    overflow: 'hidden',
  },
  photoEmpty: {
    minHeight: 176,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 66,
  },
  photoPreview: {
    width: '100%',
    minHeight: 176,
    height: 176,
  },
  photoLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
    letterSpacing: typography.letterSpacing.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  fields: {
    gap: spacing.lg,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    paddingLeft: spacing.xs,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
    letterSpacing: typography.letterSpacing.label,
    color: colors.textSecondary,
  },
  input: {
    minHeight: spacing.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    paddingHorizontal: 17,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    lineHeight: typography.lineHeights.input,
    color: colors.heading,
  },
  textarea: {
    minHeight: 89,
    paddingTop: 18,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-end',
  },
  priceShell: {
    minHeight: spacing.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  currency: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    lineHeight: typography.lineHeights.input,
    color: colors.textSecondary,
  },
  priceInput: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    lineHeight: typography.lineHeights.input,
    color: colors.heading,
  },
  select: {
    minHeight: spacing.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    paddingHorizontal: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  selectText: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    lineHeight: typography.lineHeights.input,
    color: colors.heading,
  },
  placeholder: {
    color: colors.textPlaceholder,
  },
  card: {
    backgroundColor: colors.mapFill,
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
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardTitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.headingSm,
    lineHeight: typography.lineHeights.headingSm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  cardSubtitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.regular,
    color: colors.overlayStatus,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.bold,
    letterSpacing: typography.letterSpacing.overline,
    color: colors.accent,
  },
  statusTextOff: {
    color: colors.error,
  },
  stockField: {
    gap: spacing.xs,
  },
  variantList: {
    gap: spacing.md,
  },
  variantCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.md,
    gap: spacing.md,
  },
  removeVariant: {
    width: 48,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addVariant: {
    height: 48,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  addVariantLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
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
  hint: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  saveButton: {
    height: spacing.input,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  saveDisabled: {
    opacity: 0.45,
  },
  saveLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    lineHeight: typography.lineHeights.input,
    fontWeight: typography.weights.regular,
    color: colors.white,
  },
  cancelButton: {
    height: 48,
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
  pressed: {
    opacity: 0.9,
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
    lineHeight: typography.lineHeights.headingSm,
    fontWeight: typography.weights.semibold,
  },
  option: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  optionSelected: {
    opacity: 1,
  },
  optionText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    lineHeight: typography.lineHeights.input,
    color: colors.heading,
  },
  optionTextSelected: {
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  optionCheck: {
    color: colors.primary,
    fontSize: 16,
  },
  addCategoryOption: {
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  addCategoryLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.input,
    lineHeight: typography.lineHeights.input,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  removePhotoLabel: {
    color: colors.error,
  },
});
