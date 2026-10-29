import { queryOptions, type QueryClient } from "@tanstack/react-query";
import type { Cart } from "@/contracts/cart";
import { getCart } from "./api";
export const cartKey = ["cart"] as const;
export function cartOptions() {
  return queryOptions({
    queryKey: cartKey,
    queryFn: ({ signal }) => getCart(signal),
    retry: false,
    staleTime: 0,
    structuralSharing: (current, next) =>
      keepNewestCart(current as Cart | null | undefined, next as Cart | null),
  });
}
// One rule for reads and mutation responses: an older version of the same cart
// never replaces a newer one. Equal versions are accepted (catalog prices can
// change without a cart write); a different cart id (new visitor) always wins.
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
export function storeCart(queryClient: QueryClient, next: Cart) {
  queryClient.setQueryData<Cart | null>(cartKey, (current) =>
    keepNewestCart(current, next),
  );
}
