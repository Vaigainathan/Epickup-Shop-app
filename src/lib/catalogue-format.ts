import { formatInr } from '@/lib/orders-api';

export const STOCK_REPLACE_HINT = 'This replaces the current stock count.';

export const MIXED_OPTION_NAMES_NOTE =
  'This product has more than one option name — edit it to use one name';

export function productShopVisibilityLabel(isActive: boolean): string {
  return isActive ? 'Show in shop' : 'Hidden from shop';
}

export function priceOverridePlaceholder(basePrice: number | null): string {
  if (basePrice === null || !Number.isFinite(basePrice)) {
    return 'Leave blank to use product price';
  }
  return `Leave blank to use ${formatInr(basePrice)}`;
}
