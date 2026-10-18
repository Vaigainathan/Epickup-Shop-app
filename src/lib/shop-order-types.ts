type JsonRecord = Record<string, unknown>;

export const KNOWN_ORDER_STATUSES = [
  'awaiting_payment',
  'payment_unconfirmed',
  'payment_review',
  'preparing',
  'ready',
  'handed_over',
  'completed',
  'cancelled',
  'delivery_failed',
] as const;

export type ShopOrderStatus = (typeof KNOWN_ORDER_STATUSES)[number];

export const KNOWN_PAYMENT_STATUSES = [
  'pending',
  'customer_claimed',
  'short',
  'confirmed',
  'expired',
  'under_review',
  'not_verified',
  'cancelled',
  'refund_pending',
  'refunded',
] as const;

export type ShopPaymentStatus = (typeof KNOWN_PAYMENT_STATUSES)[number];

export type ShopOrderItem = {
  productId: string | null;
  variantId: string | null;
  name: string;
  price: number;
  qty: number;
};

export type ShopOrderDriverInfo = {
  name: string;
  phone: string;
  vehicle: string;
};

export type ShopDeliveryAddress = {
  text: string;
  coordinates: { lat: number; lng: number } | null;
  label: string | null;
  houseNo: string | null;
  street: string | null;
  landmark: string | null;
  receiverName: string | null;
  receiverPhone: string | null;
};

export type ShopPaymentBalance = {
  amount: number | null;
  dueBy: Date | null;
  utr: string | null;
};

export type ShopOrderRefund = {
  id: string;
  status: string | null;
  amount: number | null;
};

export type ShopOrder = {
  id: string;
  displayId: number | null;
  handoverOtp: string | null;
  items: ShopOrderItem[];
  itemsTotal: number;
  deliveryFee: number;
  deliveryAddress: ShopDeliveryAddress | null;
  deliveryAddressText: string;
  orderStatus: ShopOrderStatus | null;
  orderStatusRaw: string;
  orderStatusKnown: boolean;
  linkedBookingId: string | null;
  driverInfo: ShopOrderDriverInfo | null;
  customerName: string | null;
  payerUpiName: string | null;
  customerNote: string | null;
  stockShort: boolean;
  stockShortOpen: boolean;
  expectedAmount: number | null;
  window: { start: Date | null; end: Date | null };
  closedReason: string | null;
  hasOpenRefund: boolean;
  help: { hasOpenHelp: boolean; status: string | null };
  refunds: ShopOrderRefund[];
  review: JsonRecord | null;
  payment: {
    status: ShopPaymentStatus | null;
    statusRaw: string | null;
    statusKnown: boolean;
    amount: number;
    shopUpiId: string | null;
    customerUpiId: string | null;
    customerUtr: string | null;
    officialUtr: string | null;
    receivedAmount: number | null;
    balance: ShopPaymentBalance | null;
    confirmedAt: Date | null;
    expiredAt: Date | null;
    refundedAt: Date | null;
  };
  cancellation: {
    reason: string | null;
    shopReason: string | null;
    paidCheck: { status: string | null; received: boolean | null } | null;
    cancelledAt: Date | null;
  };
  createdAt: Date | null;
  updatedAt: Date | null;
};

const ORDER_STATUS_SET = new Set<string>(KNOWN_ORDER_STATUSES);
const PAYMENT_STATUS_SET = new Set<string>(KNOWN_PAYMENT_STATUSES);

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' ? (value as JsonRecord) : null;
}

function readString(record: JsonRecord | null, keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function readNumber(record: JsonRecord | null, keys: string[]): number | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function readBoolean(record: JsonRecord | null, keys: string[]): boolean {
  if (!record) return false;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'boolean') return value;
  }
  return false;
}

export function parseTimestamp(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const record = asRecord(value);
  if (!record) return null;
  const seconds = readNumber(record, ['_seconds', 'seconds']);
  if (seconds !== null) {
    const nanos = readNumber(record, ['_nanoseconds', 'nanoseconds']) ?? 0;
    const date = new Date(seconds * 1000 + Math.floor(nanos / 1e6));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function parseItem(value: unknown): ShopOrderItem | null {
  const record = asRecord(value);
  if (!record) return null;
  const name = readString(record, ['name']) ?? 'Item';
  const price = readNumber(record, ['price']) ?? 0;
  const qty = readNumber(record, ['qty', 'quantity']) ?? 0;
  return {
    productId: readString(record, ['productId']),
    variantId: readString(record, ['variantId']),
    name,
    price,
    qty,
  };
}

function parseDriverInfo(value: unknown): ShopOrderDriverInfo | null {
  const record = asRecord(value);
  if (!record) return null;
  const name = readString(record, ['name']) ?? '';
  const phone = readString(record, ['phone']) ?? '';
  const vehicle = readString(record, ['vehicle', 'vehicleNumber']) ?? '';
  if (!name && !phone && !vehicle) return null;
  return { name, phone, vehicle };
}

function parseDeliveryAddress(value: unknown): ShopDeliveryAddress | null {
  const record = asRecord(value);
  if (!record) return null;
  const coords = asRecord(record.coordinates);
  const lat = readNumber(coords, ['lat', 'latitude']);
  const lng = readNumber(coords, ['lng', 'longitude']);
  const text = readString(record, ['text', 'formattedAddress']) ?? '';
  const parsed: ShopDeliveryAddress = {
    text,
    coordinates: lat !== null && lng !== null ? { lat, lng } : null,
    label: readString(record, ['label']),
    houseNo: readString(record, ['houseNo']),
    street: readString(record, ['street']),
    landmark: readString(record, ['landmark']),
    receiverName: readString(record, ['receiverName']),
    receiverPhone: readString(record, ['receiverPhone']),
  };
  const hasStructured =
    parsed.text ||
    parsed.receiverName ||
    parsed.receiverPhone ||
    parsed.houseNo ||
    parsed.street ||
    parsed.landmark ||
    parsed.label;
  return hasStructured ? parsed : null;
}

function parseBalance(value: unknown): ShopPaymentBalance | null {
  const record = asRecord(value);
  if (!record) return null;
  const utr = readString(record, ['utr']);
  const amount = readNumber(record, ['amount']);
  const dueBy = parseTimestamp(record.dueBy);
  if (amount === null && dueBy === null && !utr) return null;
  return { amount, dueBy, utr };
}

function parseRefund(value: unknown): ShopOrderRefund | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = readString(record, ['id', 'refundId']);
  if (!id) return null;
  return {
    id,
    status: readString(record, ['status']),
    amount: readNumber(record, ['amount']),
  };
}

function parsePaidCheck(value: unknown): ShopOrder['cancellation']['paidCheck'] {
  const record = asRecord(value);
  if (!record) return null;
  const status = readString(record, ['status']);
  const received = record.received;
  return {
    status,
    received: typeof received === 'boolean' ? received : null,
  };
}

export function hasBalanceUtr(order: ShopOrder): boolean {
  const utr = order.payment.balance?.utr;
  return typeof utr === 'string' && utr.length > 0;
}

/** Labeling: legacy `initiated` is treated like `pending`. */
export function paymentStatusForLabel(order: ShopOrder): string | null {
  const raw = order.payment.statusRaw ?? order.payment.status;
  if (!raw) return order.payment.status;
  if (raw === 'initiated') return 'pending';
  return raw;
}

export function isPaidCheckPending(order: ShopOrder): boolean {
  const status = order.cancellation.paidCheck?.status?.toLowerCase();
  return status === 'pending';
}

export function shopOrderLabelShort(order: ShopOrder): string {
  if (!order.orderStatusKnown || order.orderStatus === null) {
    return 'Needs attention';
  }

  const status = order.orderStatus;
  const pay = paymentStatusForLabel(order);

  if (status === 'awaiting_payment') {
    if (pay === 'pending' || pay === 'initiated') return 'Incoming payment';
    if (pay === 'customer_claimed') return 'UTR entered';
    if (pay === 'short') {
      return hasBalanceUtr(order) ? 'Balance sent' : 'Amount short';
    }
  }

  if (status === 'payment_unconfirmed') return 'Not confirmed';
  if (status === 'payment_review') return 'Under review';

  if (status === 'cancelled') {
    if (isPaidCheckPending(order)) return 'Check payment';
    const closed = order.closedReason ?? '';
    if (closed === 'unconfirmed_expired') return 'Closed';
    if (closed === 'payment_not_verified') return 'Closed';
    if (closed === 'balance_expired') return 'Balance not paid';
    return 'Cancelled';
  }

  if (status === 'preparing') return 'Preparing';
  if (status === 'ready') return 'Ready';
  if (status === 'handed_over') return 'Handed over';
  if (status === 'completed') return 'Done';
  if (status === 'delivery_failed') return 'Needs attention';

  return 'Needs attention';
}

export function shopOrderLabelDetail(order: ShopOrder): string {
  if (!order.orderStatusKnown || order.orderStatus === null) {
    return 'This order needs attention — contact support if unsure.';
  }

  const status = order.orderStatus;
  const pay = paymentStatusForLabel(order);

  if (status === 'awaiting_payment') {
    if (pay === 'pending' || pay === 'initiated') {
      return 'Check your UPI app for the payment, then confirm.';
    }
    if (pay === 'customer_claimed') {
      return 'Customer entered a UTR — check and confirm.';
    }
    if (pay === 'short') {
      return hasBalanceUtr(order)
        ? 'Customer sent the balance — check and confirm.'
        : 'Customer paid less — balance due.';
    }
  }

  if (status === 'payment_unconfirmed') {
    return 'Payment window passed — you can still confirm if you received it.';
  }
  if (status === 'payment_review') {
    return 'Support is checking this payment — answer Received or Not found.';
  }

  if (status === 'cancelled') {
    if (isPaidCheckPending(order)) {
      return 'Customer cancelled after entering a UTR — did you receive it?';
    }
    const closed = order.closedReason ?? '';
    if (closed === 'unconfirmed_expired') return 'Closed — payment not confirmed.';
    if (closed === 'payment_not_verified') return 'Closed — payment not verified.';
    if (closed === 'balance_expired') return 'Balance not paid — refund due.';
    return cancelledDetailCopy(order);
  }

  if (status === 'delivery_failed') {
    return 'This order needs attention — contact support if unsure.';
  }

  return '';
}

export function showRefundDuePill(order: ShopOrder): boolean {
  return order.hasOpenRefund === true;
}

export function cancelledDetailCopy(order: ShopOrder): string {
  const closed = order.closedReason?.trim();
  if (closed === 'unconfirmed_expired') return 'Closed — payment not confirmed.';
  if (closed === 'payment_not_verified') return 'Closed — payment not verified.';
  if (closed === 'balance_expired') return 'Balance not paid — refund due.';
  const shopReason = order.cancellation.shopReason?.trim();
  if (shopReason) return shopReason;
  const reason = order.cancellation.reason?.trim();
  if (reason) return reason;
  if (order.payment.status === 'expired' || order.payment.statusRaw === 'expired') {
    return "Payment wasn't confirmed in time";
  }
  return 'Order was rejected';
}

export function formatIstTime(date: Date | null): string | null {
  if (!date) return null;
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return null;
  }
}

export function mergeAwaitingPaymentOrders(batches: ShopOrder[][]): ShopOrder[] {
  const byId = new Map<string, ShopOrder>();
  for (const batch of batches) {
    for (const order of batch) {
      byId.set(order.id, order);
    }
  }
  return [...byId.values()].sort((a, b) => {
    const aTime = a.createdAt?.getTime() ?? 0;
    const bTime = b.createdAt?.getTime() ?? 0;
    return bTime - aTime;
  });
}

export function parseOrder(value: unknown): ShopOrder | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = readString(record, ['id']);
  if (!id) return null;

  const orderStatusRaw = readString(record, ['orderStatus']) ?? '';
  const orderStatusKnown = ORDER_STATUS_SET.has(orderStatusRaw);
  const orderStatus = orderStatusKnown ? (orderStatusRaw as ShopOrderStatus) : null;

  const paymentRecord = asRecord(record.payment) ?? {};
  const paymentStatusRaw = readString(paymentRecord, ['status']);
  const paymentStatusKnown = paymentStatusRaw !== null && PAYMENT_STATUS_SET.has(paymentStatusRaw);
  const paymentStatus =
    paymentStatusKnown && paymentStatusRaw ? (paymentStatusRaw as ShopPaymentStatus) : null;

  const cancellation = asRecord(record.cancellation) ?? {};
  const addressRecord = record.deliveryAddress;
  const deliveryAddress = parseDeliveryAddress(addressRecord);
  const itemsRaw = Array.isArray(record.items) ? record.items : [];
  const items = itemsRaw.map(parseItem).filter((item): item is ShopOrderItem => item !== null);
  const itemsTotal = readNumber(record, ['itemsTotal']) ?? 0;
  const paymentAmount = readNumber(paymentRecord, ['amount']) ?? itemsTotal;
  const windowRecord = asRecord(record.window);
  const helpRecord = asRecord(record.help);
  const refundsRaw = Array.isArray(record.refunds) ? record.refunds : [];

  return {
    id,
    displayId: readNumber(record, ['displayId']),
    handoverOtp: readString(record, ['handoverOtp']),
    items,
    itemsTotal,
    deliveryFee: readNumber(record, ['deliveryFee']) ?? 0,
    deliveryAddress,
    deliveryAddressText: deliveryAddress?.text ?? readString(asRecord(addressRecord), ['text']) ?? '',
    orderStatus,
    orderStatusRaw,
    orderStatusKnown,
    linkedBookingId: readString(record, ['linkedBookingId']),
    driverInfo: parseDriverInfo(record.driverInfo),
    customerName: readString(record, ['customerName']),
    payerUpiName: readString(record, ['payerUpiName']),
    customerNote: readString(record, ['customerNote']),
    stockShort: readBoolean(record, ['stockShort']),
    stockShortOpen: readBoolean(record, ['stockShortOpen']),
    expectedAmount: readNumber(record, ['expectedAmount']),
    window: {
      start: parseTimestamp(windowRecord?.start),
      end: parseTimestamp(windowRecord?.end),
    },
    closedReason: readString(record, ['closedReason']),
    hasOpenRefund: readBoolean(record, ['hasOpenRefund']),
    help: {
      hasOpenHelp: readBoolean(helpRecord, ['hasOpenHelp']),
      status: readString(helpRecord, ['status']),
    },
    refunds: refundsRaw.map(parseRefund).filter((r): r is ShopOrderRefund => r !== null),
    review: asRecord(record.review),
    payment: {
      status: paymentStatus,
      statusRaw: paymentStatusRaw,
      statusKnown: paymentStatusKnown,
      amount: paymentAmount,
      shopUpiId: readString(paymentRecord, ['shopUpiId', 'upiId']),
      customerUpiId: readString(paymentRecord, ['customerUpiId']),
      customerUtr: readString(paymentRecord, ['customerUtr']),
      officialUtr: readString(paymentRecord, ['officialUtr']),
      receivedAmount: readNumber(paymentRecord, ['receivedAmount']),
      balance: parseBalance(paymentRecord.balance),
      confirmedAt: parseTimestamp(paymentRecord.confirmedAt),
      expiredAt: parseTimestamp(paymentRecord.expiredAt),
      refundedAt: parseTimestamp(paymentRecord.refundedAt),
    },
    cancellation: {
      reason: readString(cancellation, ['reason']),
      shopReason: readString(cancellation, ['shopReason']),
      paidCheck: parsePaidCheck(cancellation.paidCheck),
      cancelledAt: parseTimestamp(cancellation.cancelledAt),
    },
    createdAt: parseTimestamp(record.createdAt),
    updatedAt: parseTimestamp(record.updatedAt),
  };
}
