export const SHOP_TYPES = [
  'Food & Restaurants',
  'Grocery & Supermarket',
  'Meat & Seafood',
  'Fashion & Clothing',
  'Electronics & Electrical',
  'Home & Kitchen',
  'Hardware & Tools',
  'Beauty & Personal Care',
  'Sports & Fitness',
  'Books & Stationery',
  'Automotive Spares & Lubricants',
  'Baby & Kids',
  'Pet Supplies',
  'Gifts, Flowers & Accessories',
] as const;

export type ShopType = (typeof SHOP_TYPES)[number];

export const FSSAI_REQUIRED_SHOP_TYPES = [
  'Food & Restaurants',
  'Grocery & Supermarket',
  'Meat & Seafood',
] as const;

export function isFssaiRequiredShopType(shopType: string | null | undefined): boolean {
  if (!shopType) return false;
  return (FSSAI_REQUIRED_SHOP_TYPES as readonly string[]).includes(shopType);
}
