const FALLBACK = ['Size', 'Color', 'Weight'] as const;

const CHIPS_BY_SHOP_TYPE: Record<string, readonly string[]> = {
  'Fashion & Clothing': ['Size', 'Color'],
  'Sports & Fitness': ['Size', 'Color'],
  'Baby & Kids': ['Size', 'Color'],
  'Grocery & Supermarket': ['Weight'],
  'Meat & Seafood': ['Weight'],
  'Food & Restaurants': ['Portion', 'Spice Level'],
  'Electronics & Electrical': ['Color', 'Storage'],
  'Beauty & Personal Care': ['Shade', 'Size'],
};

export function chipsForShopType(shopType: string | null): readonly string[] {
  if (!shopType) return FALLBACK;
  return CHIPS_BY_SHOP_TYPE[shopType] ?? FALLBACK;
}
