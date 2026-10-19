import type { ShopOrder, ShopOrderItem } from '@/lib/shop-order-types';

/**
 * Line id for mark-unavailable `itemIds` (shopOrderService / createCustomerOrder):
 * non-empty `item.id`, else `line${index}` (0-based in items[]).
 */
export function orderItemLineId(item: ShopOrderItem, index: number): string {
  const id = item.id?.trim();
  if (id) return id;
  return `line${index}`;
}

export function isItemMarkableUnavailable(item: ShopOrderItem): boolean {
  return !item.unavailable;
}

export function markableUnavailableItems(order: ShopOrder): ShopOrderItem[] {
  if (order.orderStatus !== 'preparing') return [];
  return order.items.filter(isItemMarkableUnavailable);
}

export function markableLineIds(order: ShopOrder): string[] {
  if (order.orderStatus !== 'preparing') return [];
  return order.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => isItemMarkableUnavailable(item))
    .map(({ item, index }) => orderItemLineId(item, index));
}

export function validateMarkUnavailableSelection(
  order: ShopOrder,
  selectedIds: string[],
): { ok: true; itemIds: string[] } | { ok: false; reason: string } {
  const allowed = new Set(markableLineIds(order));
  if (selectedIds.length === 0) {
    return { ok: false, reason: 'Select at least one item.' };
  }
  const unique = [...new Set(selectedIds)];
  for (const id of unique) {
    if (!allowed.has(id)) {
      return { ok: false, reason: 'One or more items can’t be marked unavailable.' };
    }
  }
  return { ok: true, itemIds: unique };
}
