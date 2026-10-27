import type { ShopOpenIndicatorInput } from '@/lib/shop-open-indicator';

export type ShopOpenChipVariant = 'openNow' | 'outsideHours' | 'manuallyClosed';

export function shopOpenChipVariant(input: ShopOpenIndicatorInput): ShopOpenChipVariant {
  if (!input.isOpen) return 'manuallyClosed';
  if (input.isOpenNow) return 'openNow';
  return 'outsideHours';
}
