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
  });
}
// Mutation responses carry the full cart; never let an older version of the
// same cart replace a newer one already in the cache.
export function storeCart(queryClient: QueryClient, next: Cart) {
  queryClient.setQueryData<Cart | null>(cartKey, (current) =>
    current && current.id === next.id && current.version > next.version
      ? current
      : next,
  );
}
