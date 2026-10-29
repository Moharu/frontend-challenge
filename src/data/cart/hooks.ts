import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cartScope, useIdentity } from "@/data/session/identity";
import type { CartResult } from "./api";
import { cartKey, cartOptions, storeCart } from "./queries";
export const useCart = () => useQuery(cartOptions(cartScope(useIdentity())));
// Successful mutations replace the cart with the API response (for the scope
// they were sent with); failures leave the cached cart untouched.
export function useCartMutation<Input>(
  run: (input: Input) => Promise<CartResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Input) => {
      const result = await run(input);
      storeCart(queryClient, result);
      return result.cart;
    },
    onMutate: () =>
      queryClient.cancelQueries({ queryKey: cartKey(cartScope()) }),
  });
}
export function cartCountLabel(count: number) {
  return count === 0
    ? "Carrinho, vazio"
    : `Carrinho, ${count} ${count === 1 ? "item" : "itens"}`;
}
export const badgeText = (count: number) =>
  count > 99 ? "99+" : String(count);
