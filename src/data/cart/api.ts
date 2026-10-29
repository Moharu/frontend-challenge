import axios, { type Method } from "axios";
import { http } from "@/lib/http";
import { UserFacingError } from "@/lib/api-error";
import { isCart, type Cart } from "@/contracts/cart";
import { record } from "@/contracts/common";
import {
  cartScope,
  getIdentity,
  identityHeaders,
  sameScope,
  setVisitorToken,
  verifySession,
  type CartScope,
  type Identity,
} from "@/data/session/identity";
import { notify } from "@/data/session/notices";
// A cart response always travels with the scope it was requested for, so the
// cache only accepts it while that scope is still current.
export interface CartResult {
  cart: Cart;
  scope: CartScope;
}
const lostVisitorCart =
  "Seu carrinho anterior não está mais disponível. Repita a ação para começar um novo carrinho.";
let issuing: Promise<string> | null = null;
function issueVisitor() {
  issuing ??= http
    .post<unknown>("/visitor-sessions")
    .then(({ data }) => {
      if (
        !record(data) ||
        !record(data.data) ||
        typeof data.data.token !== "string"
      )
        throw new Error("Invalid visitor session response");
      setVisitorToken(data.data.token);
      return data.data.token;
    })
    .finally(() => {
      issuing = null;
    });
  return issuing;
}
function errorCode(error: unknown) {
  if (!axios.isAxiosError(error)) return undefined;
  const body = error.response?.data as unknown;
  return record(body) && record(body.error) ? body.error.code : undefined;
}
async function send(
  method: Method,
  url: string,
  identity: Identity,
  data?: unknown,
  signal?: AbortSignal,
): Promise<Cart> {
  const { data: value } = await http.request<unknown>({
    method,
    url,
    data,
    signal,
    headers: identityHeaders(identity),
  });
  if (!record(value) || !isCart(value.data))
    throw new Error("Invalid cart response");
  return value.data;
}
// An unknown visitor token (e.g. after a mock reset) only ever means a lost
// visitor cart; it is never confused with an expired session.
function visitorLost(error: unknown, identity: Identity) {
  if (errorCode(error) !== "VISITOR_INVALID") return false;
  if (getIdentity().visitorToken === identity.visitorToken)
    setVisitorToken(null);
  return true;
}
export async function getCart(
  scope: CartScope,
  signal?: AbortSignal,
): Promise<Cart | null> {
  const identity = getIdentity();
  if (!sameScope(scope, cartScope(identity))) return null;
  if (scope?.kind === "visitor" && !scope.token) return null;
  try {
    return await send("GET", "/cart", identity, undefined, signal);
  } catch (error) {
    if (!visitorLost(error, identity)) throw error;
    notify("Seu carrinho anterior não está mais disponível.");
    return null;
  }
}
// Mutations create a visitor on demand. A lost visitor cart is reported to the
// user instead of applying the operation to a fresh empty cart in silence.
async function mutate(method: Method, url: string, data?: unknown) {
  if (getIdentity().status === "checking") await verifySession();
  if (!getIdentity().sessionToken && !getIdentity().visitorToken)
    await issueVisitor();
  const identity = getIdentity();
  const scope = cartScope(identity);
  try {
    return { cart: await send(method, url, identity, data), scope };
  } catch (error) {
    if (!visitorLost(error, identity)) throw error;
    notify(lostVisitorCart);
    throw new UserFacingError(lostVisitorCart);
  }
}
export const addCartItem = (body: {
  nftId: string;
  editionId: string;
  quantity: number;
}) => mutate("POST", "/cart/items", body);
export const changeCartItem = (
  itemId: string,
  body: { quantity?: number; acknowledgePriceEth?: string },
) => mutate("PATCH", `/cart/items/${encodeURIComponent(itemId)}`, body);
export const removeCartItem = (itemId: string) =>
  mutate("DELETE", `/cart/items/${encodeURIComponent(itemId)}`);
export const applyCoupon = (code: string) =>
  mutate("PUT", "/cart/coupon", { code });
export const removeCoupon = () => mutate("DELETE", "/cart/coupon");
