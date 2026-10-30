import { forgetPendingOrders } from "@/data/orders/pending";
// Checkout draft: what the user typed and the chosen wallet, in sessionStorage
// keyed by user id. It survives a refresh and a session expiry (the same user
// signing in again finds it filled in), and is discarded on logout and when
// another user signs in. Never stored: wallet connection state and quote
// values, which are always fetched again.
export interface CheckoutDraft {
  fields: Record<string, string>;
  walletId: string | null;
}
const prefix = "kurio.checkout.draft.v1:";
const keyFor = (userId: string) => `${prefix}${userId}`;
export function loadDraft(userId: string): CheckoutDraft | null {
  try {
    const raw = sessionStorage.getItem(keyFor(userId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<CheckoutDraft>;
    const fields =
      value.fields && typeof value.fields === "object" ? value.fields : {};
    return {
      fields: Object.fromEntries(
        Object.entries(fields).filter(([, v]) => typeof v === "string"),
      ),
      walletId: typeof value.walletId === "string" ? value.walletId : null,
    };
  } catch {
    return null;
  }
}
export function saveDraft(userId: string, draft: CheckoutDraft) {
  try {
    sessionStorage.setItem(keyFor(userId), JSON.stringify(draft));
  } catch {
    // Storage unavailable: the draft lives only in memory for this page.
  }
}
// Removes every user's draft and pending order key (see
// data/orders/pending.ts), or every one but `keepUserId`'s.
const orderPrefix = "kurio.checkout.order.v1:";
export function discardDrafts(keepUserId?: string) {
  forgetPendingOrders(keepUserId);
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      const owned = [prefix, orderPrefix].find((p) => key?.startsWith(p));
      if (key && owned && key !== `${owned}${keepUserId ?? ""}`)
        sessionStorage.removeItem(key);
    }
  } catch {
    // Nothing stored.
  }
}
