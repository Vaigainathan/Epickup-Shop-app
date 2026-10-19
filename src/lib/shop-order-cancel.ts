import type { ShopOrder } from '@/lib/shop-order-types';

/** Shop cancel per §9.2 / backend: preparing, or ready only while delivery is still searching. */
export function canShopCancelOrder(order: ShopOrder): boolean {
  if (order.orderStatus === 'payment_review') return false;
  if (order.orderStatus === 'preparing') return true;
  if (order.orderStatus === 'ready') {
    return order.delivery.stage === 'searching';
  }
  return false;
}
