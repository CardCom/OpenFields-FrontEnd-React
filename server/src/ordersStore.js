import { randomUUID } from 'node:crypto';

// In-memory only — resets on restart and does not work across multiple instances.
// A production backend must persist orders in a real database (reusing the
// merchant's existing orders table, per the CardCom OpenFields integration guide).
const orders = new Map();

export function createOrder({ amount, currency, isoCoinId, productName, language }) {
  const id = randomUUID();
  const order = {
    id,
    amount,
    currency,
    isoCoinId,
    productName,
    language,
    status: 'pending',
    lowProfileId: null,
    transactionId: null,
    failureReason: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  orders.set(id, order);
  return order;
}

export function getOrder(id) {
  return orders.get(id);
}

export function attachLowProfile(id, lowProfileId) {
  const order = orders.get(id);
  if (!order) return;
  order.lowProfileId = lowProfileId;
  order.updatedAt = new Date().toISOString();
}

export function markPaid(id, transactionId) {
  const order = orders.get(id);
  if (!order || order.status === 'paid') return order; // idempotent
  order.status = 'paid';
  order.transactionId = transactionId;
  order.updatedAt = new Date().toISOString();
  return order;
}

export function markFailed(id, reason) {
  const order = orders.get(id);
  if (!order || order.status === 'paid') return order; // never downgrade a paid order
  order.status = 'failed';
  order.failureReason = reason;
  order.updatedAt = new Date().toISOString();
  return order;
}
