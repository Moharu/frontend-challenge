import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Cart } from "@/contracts/cart";
import { cartKey, cartOptions, storeCart } from "./queries";
export const useCart = () => useQuery(cartOptions());
// Successful mutations replace the cart with the API response; failures leave
// the cached cart untouched so the previous state stays visible.
export function useCartMutation<Input>(run: (input: Input) => Promise<Cart>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onMutate: () => queryClient.cancelQueries({ queryKey: cartKey }),
    onSuccess: (cart) => storeCart(queryClient, cart),
  });
}
export function cartCountLabel(count: number) {
  return count === 0
    ? "Carrinho, vazio"
    : `Carrinho, ${count} ${count === 1 ? "item" : "itens"}`;
}
export const badgeText = (count: number) =>
  count > 99 ? "99+" : String(count);
