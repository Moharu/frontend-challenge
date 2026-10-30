import { canonicalJson, type CreateOrderBody } from "@/contracts/orders";
// The order being sent: idempotency key, canonical body and the body itself,
// in sessionStorage keyed by user id, written before the request leaves.
// A refresh, timeout or retry reuses the same key, so the server returns the
// same order. Discarded once the user sees the order in a terminal state, on
// logout and when another user signs in (see draft.ts).
export interface PendingOrder {
  key: string;
  canonical: string;
  body: CreateOrderBody;
  // Set once the server has answered with the order.
  orderId: string | null;
}
export const pendingOrderPrefix = "kurio.checkout.order.v1:";
const keyFor = (userId: string) => `${pendingOrderPrefix}${userId}`;
export function loadPendingOrder(userId: string): PendingOrder | null {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(keyFor(userId)) ?? "null",
    ) as PendingOrder | null;
    return value && typeof value.key === "string" && value.body ? value : null;
  } catch {
    return null;
  }
}
function save(userId: string, value: PendingOrder) {
  try {
    sessionStorage.setItem(keyFor(userId), JSON.stringify(value));
  } catch {
    // Storage unavailable: the key lives only for this page.
  }
}
// The key for this body: the stored one when the body is the same (a retry),
// otherwise a new one (the user confirmed different values).
export function pendingOrderFor(
  userId: string,
  body: CreateOrderBody,
): PendingOrder {
  const canonical = canonicalJson(body);
  const stored = loadPendingOrder(userId);
  if (stored && stored.canonical === canonical) return stored;
  const next: PendingOrder = {
    key: crypto.randomUUID(),
    canonical,
    body,
    orderId: null,
  };
  save(userId, next);
  return next;
}
export function markPendingOrderCreated(userId: string, orderId: string) {
  const stored = loadPendingOrder(userId);
  if (stored) save(userId, { ...stored, orderId });
}
export function discardPendingOrder(userId: string, orderId?: string) {
  const stored = loadPendingOrder(userId);
  if (!stored || (orderId && stored.orderId && stored.orderId !== orderId))
    return;
  try {
    sessionStorage.removeItem(keyFor(userId));
  } catch {
    // Nothing stored.
  }
}
