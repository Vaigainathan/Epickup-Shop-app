import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Href, router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
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
  fetchShopCategories,
  fetchShopProducts,
  ShopCategory,
  ShopProduct,
} from '@/lib/catalogue-api';

const emptyIllustration = require('@/assets/images/catalogue/empty-catalog.png');

const ALL_ITEMS = 'all';

function formatPrice(price: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: price % 1 === 0 ? 0 : 2,
  }).format(price);
}

function allVariantsOutOfStock(product: ShopProduct) {
  return (
    product.variants.length > 0 &&
    product.variants.every((variant) => (variant.stock ?? 0) === 0)
  );
}

function someVariantOutOfStock(product: ShopProduct) {
  return product.variants.some((variant) => (variant.stock ?? 0) === 0);
}

export default function CatalogueScreen() {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState(ALL_ITEMS);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [nextProducts, nextCategories] = await Promise.all([
        fetchShopProducts(),
        fetchShopCategories(),
      ]);
      setProducts(nextProducts);
      setCategories(nextCategories);
      setSelectedCategoryId((current) =>
        current === ALL_ITEMS || nextCategories.some((category) => category.id === current)
          ? current
          : ALL_ITEMS,
      );
    } catch (loadError) {
      setError(
        loadError instanceof CatalogueApiError
          ? loadError.message
          : 'Could not load your catalogue.',
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

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory =
        selectedCategoryId === ALL_ITEMS || product.categoryId === selectedCategoryId;
      const matchesSearch = query.length === 0 || product.name.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [products, search, selectedCategoryId]);

  function openAddProduct() {
    router.push('/(app)/(catalogue)/add-product' as Href);
  }

  function openCategories() {
    router.push('/(app)/(catalogue)/categories' as Href);
  }

  function openProduct(id: string) {
    router.push(`/(app)/(catalogue)/product-details?id=${encodeURIComponent(id)}` as Href);
  }

  if (loading && products.length === 0 && categories.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenLoading />
      </SafeAreaView>
    );
  }

  if (error && products.length === 0 && categories.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenError message={error} onRetry={load} />
      </SafeAreaView>
    );
  }

  const isEmptyCatalogue = products.length === 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Catalog</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Manage categories"
          onPress={openCategories}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
          <MaterialCommunityIcons name="tag-outline" size={22} color={colors.heading} />
        </Pressable>
      </View>

      <View style={styles.searchShell}>
        <MaterialCommunityIcons name="magnify" size={18} color={colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search products..."
          placeholderTextColor={colors.textPlaceholder}
          style={styles.searchInput}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipRow}>
        <CategoryChip
          label="All items"
          selected={selectedCategoryId === ALL_ITEMS}
          onPress={() => setSelectedCategoryId(ALL_ITEMS)}
        />
        {categories.map((category) => (
          <CategoryChip
            key={category.id}
            label={category.name}
            selected={selectedCategoryId === category.id}
            onPress={() => setSelectedCategoryId(category.id)}
          />
        ))}
      </ScrollView>

      {isEmptyCatalogue ? (
        <View style={styles.empty}>
          <Image source={emptyIllustration} style={styles.emptyImage} contentFit="contain" />
          <Text style={styles.emptyTitle}>Your Catalog is Empty</Text>
          <Text style={styles.emptyBody}>
            Add your first product to start receiving orders and go live on the ePickup network.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={openAddProduct}
            style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
            <MaterialCommunityIcons name="plus" size={14} color={colors.white} />
            <Text style={styles.ctaLabel}>Add your first product</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.noMatches}>No matching products</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => openProduct(item.id)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
              {item.photoUrl ? (
                <Image source={{ uri: item.photoUrl }} style={styles.photo} contentFit="cover" />
              ) : (
                <View style={styles.photoFallback} />
              )}
              <View style={styles.cardMeta}>
                <View style={styles.cardTopRow}>
                  {item.hasVariants ? (
                    allVariantsOutOfStock(item) ? (
                      <View style={[styles.stockPill, styles.stockPillOut]}>
                        <Text style={[styles.stockText, styles.stockTextOut]}>Out of Stock</Text>
                      </View>
                    ) : (
                      <View style={styles.badgeRow}>
                        <View style={styles.optionsPill}>
                          <Text style={styles.optionsText}>
                            {item.variants.length}{' '}
                            {item.variants.length === 1 ? 'option' : 'options'}
                          </Text>
                        </View>
                        {someVariantOutOfStock(item) ? (
                          <MaterialCommunityIcons
                            name="alert-circle-outline"
                            size={16}
                            color={colors.error}
                            accessibilityLabel="A variant is out of stock"
                          />
                        ) : null}
                      </View>
                    )
                  ) : (
                    <View style={[styles.stockPill, !item.isActive && styles.stockPillOut]}>
                      <Text style={[styles.stockText, !item.isActive && styles.stockTextOut]}>
                        {item.isActive ? 'In Stock' : 'Out of Stock'}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.price}>
                    {formatPrice(item.price)} / {item.unitType}
                  </Text>
                </View>
                <Text style={styles.productName} numberOfLines={2}>
                  {item.name}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add product"
        onPress={openAddProduct}
        style={({ pressed }) => [styles.fab, pressed && styles.pressed]}>
        <MaterialCommunityIcons name="plus" size={22} color={colors.white} />
      </Pressable>
    </SafeAreaView>
  );
}

type CategoryChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

function CategoryChip({ label, selected, onPress }: CategoryChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.heading,
    lineHeight: typography.lineHeights.heading,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.heading,
    color: colors.heading,
  },
  headerButton: {
    width: 48,
    height: 48,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchShell: {
    marginHorizontal: spacing.screen,
    minHeight: spacing.input,
    borderRadius: 12,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.regular,
    color: colors.heading,
  },
  chipRow: {
    flexGrow: 0,
    marginTop: spacing.md,
  },
  chips: {
    paddingHorizontal: spacing.screen,
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  chip: {
    backgroundColor: colors.tintSoft,
    borderRadius: 9999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipSelected: {
    backgroundColor: colors.primary,
  },
  chipLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.button,
    color: colors.textSecondary,
  },
  chipLabelSelected: {
    color: colors.white,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptyImage: {
    width: 192,
    height: 192,
  },
  emptyTitle: {
    marginTop: spacing.md,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.headingSm,
    lineHeight: typography.lineHeights.headingSm,
    fontWeight: typography.weights.semibold,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 6,
  },
  ctaLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.button,
    color: colors.white,
  },
  gridContent: {
    paddingHorizontal: spacing.screen,
    paddingBottom: 96,
    gap: spacing.md,
  },
  gridRow: {
    gap: spacing.md,
  },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  photo: {
    width: '100%',
    height: 149,
    borderRadius: 8,
    backgroundColor: colors.mapFill,
  },
  photoFallback: {
    width: '100%',
    height: 149,
    borderRadius: 8,
    backgroundColor: colors.tintSoft,
  },
  cardMeta: {
    gap: spacing.xs,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: spacing.xs,
  },
  optionsPill: {
    backgroundColor: colors.tintSoft,
    borderRadius: 9999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  optionsText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    fontWeight: typography.weights.medium,
    letterSpacing: typography.letterSpacing.label,
    color: colors.primary,
  },
  stockPill: {
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
  price: {
    flexShrink: 1,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.regular,
    color: colors.primary,
    textAlign: 'right',
  },
  productName: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.regular,
    color: colors.heading,
  },
  noMatches: {
    marginTop: spacing.xl,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.regular,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 23,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.1,
    shadowRadius: 25,
    elevation: 8,
  },
  pressed: {
    opacity: 0.9,
  },
});
