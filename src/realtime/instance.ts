import type { CatalogRealtime } from "./catalog";
// The realtime client owned by PublicLayout, for pages that follow private
// events (the order page). Subscribers hear when it is created or disposed.
let current: CatalogRealtime | null = null;
const listeners = new Set<() => void>();
export function setRealtime(next: CatalogRealtime | null) {
  current = next;
  listeners.forEach((listener) => listener());
}
export const getRealtime = () => current;
export function subscribeRealtime(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
