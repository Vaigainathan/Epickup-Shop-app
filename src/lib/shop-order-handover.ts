import { formatDisplayId } from '@/lib/orders-api';
import { formatIstTime, type ShopOrder } from '@/lib/shop-order-types';

const POST_ASSIGNMENT_STAGES = new Set(['assigned', 'at_shop', 'picked_up']);

function normalizedStage(order: ShopOrder): string | null {
  const raw = order.delivery.stage?.trim().toLowerCase();
  return raw && raw.length > 0 ? raw : null;
}

export function shouldShowDeliveryPartnerCard(order: ShopOrder): boolean {
  return order.orderStatus === 'ready' || order.orderStatus === 'handed_over';
}

export function isWaitingForDeliveryPartner(order: ShopOrder): boolean {
  if (order.orderStatus !== 'ready') return false;
  const stage = normalizedStage(order);
  return stage === null || stage === 'searching';
}

export function shouldShowDriverCard(order: ShopOrder): boolean {
  if (!shouldShowDeliveryPartnerCard(order)) return false;
  if (isWaitingForDeliveryPartner(order)) return false;
  if (order.orderStatus === 'handed_over') return order.driverInfo !== null;
  const stage = normalizedStage(order);
  if (stage && POST_ASSIGNMENT_STAGES.has(stage)) return order.driverInfo !== null;
  return false;
}

export function shopPickedUpTime(order: ShopOrder): Date | null {
  return order.handedOverAt ?? order.updatedAt;
}

export function shopDeliveryPartnerMessage(order: ShopOrder): string | null {
  if (!shouldShowDeliveryPartnerCard(order)) return null;

  if (order.orderStatus === 'handed_over' || normalizedStage(order) === 'picked_up') {
    const name = order.driverInfo?.name?.trim() || 'Delivery partner';
    const time = formatIstTime(shopPickedUpTime(order)) ?? '—';
    return `Picked up by ${name} at ${time}`;
  }

  if (isWaitingForDeliveryPartner(order)) {
    return 'Waiting for a delivery partner';
  }

  const stage = normalizedStage(order);
  if (stage === 'assigned') {
    return 'On the way to your shop';
  }
  if (stage === 'at_shop') {
    return `Delivery partner has arrived — hand over order ${formatDisplayId(order.displayId)}`;
  }

  return 'Waiting for a delivery partner';
}
