import { queryOptions, type QueryClient } from "@tanstack/react-query";
import type { Cart } from "@/contracts/cart";
import { cartScope, sameScope, type CartScope } from "@/data/session/identity";
import { getCart, type CartResult } from "./api";
// Private cache entries are scoped by identity: a visitor token, or a user and
// session generation. Another identity never reads or writes this key.
export const cartKey = (scope: CartScope) => ["cart", scope] as const;
export function cartOptions(scope: CartScope) {
  return queryOptions({
    queryKey: cartKey(scope),
    queryFn: ({ signal }) => getCart(scope, signal),
    // A stored session is verified before its cart is requested.
    enabled: scope !== null,
    retry: false,
    staleTime: 0,
    structuralSharing: (current, next) =>
      keepNewestCart(current as Cart | null | undefined, next as Cart | null),
  });
}
// One rule for reads and mutation responses within a scope: an older version
// of the same cart never replaces a newer one. Equal versions are accepted
// (catalog prices change without a cart write); another cart id wins.
export function keepNewestCart(
  current: Cart | null | undefined,
  next: Cart | null,
) {
  return current &&
    next &&
    current.id === next.id &&
    current.version > next.version
    ? current
    : next;
}
// Responses for a scope that is no longer current (logout, user switch,
// expiry) are discarded.
export function storeCart(queryClient: QueryClient, result: CartResult) {
  if (!sameScope(result.scope, cartScope())) return;
  queryClient.setQueryData<Cart | null>(cartKey(result.scope), (current) =>
    keepNewestCart(current, result.cart),
  );
}
