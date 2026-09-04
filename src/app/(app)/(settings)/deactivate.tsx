import { PlaceholderScreen } from '@/components/placeholder-screen';

// Future real screen must POST /api/shop/deactivate and handle 409 ORDERS_IN_PROGRESS
// (in-flight orders: stay visible, stop new orders, finish current). Do not assume
// success. Backend hasInProgressOrders() is hardcoded false until marketplaceOrders exists.
export default function DeactivateShopScreen() {
  return <PlaceholderScreen title="Deactivate Shop" message="Not built yet." />;
}
