import axios, { type Method } from "axios";
import { http } from "@/lib/http";
import { isCart, visitorHeader, type Cart } from "@/contracts/cart";
import { record } from "@/contracts/common";
import { setVisitorToken, visitorToken } from "./visitor";
let issuing: Promise<string> | null = null;
function issueToken() {
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
function sessionInvalid(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 401;
}
async function send(
  method: Method,
  url: string,
  token: string,
  data?: unknown,
  signal?: AbortSignal,
): Promise<Cart> {
  const { data: value } = await http.request<unknown>({
    method,
    url,
    data,
    signal,
    headers: { [visitorHeader]: token },
  });
  if (!record(value) || !isCart(value.data))
    throw new Error("Invalid cart response");
  return value.data;
}
// Without a token there is no cart yet: reads resolve to null without a request.
export async function getCart(signal?: AbortSignal): Promise<Cart | null> {
  const token = visitorToken();
  if (!token) return null;
  try {
    return await send("GET", "/cart", token, undefined, signal);
  } catch (error) {
    if (!sessionInvalid(error)) throw error;
    setVisitorToken(null);
    return null;
  }
}
// Mutations create the visitor on demand; an unknown token (e.g. after a mock
// reset) is replaced once with a fresh visitor and an empty cart.
async function mutate(method: Method, url: string, data?: unknown) {
  const token = visitorToken() ?? (await issueToken());
  try {
    return await send(method, url, token, data);
  } catch (error) {
    if (!sessionInvalid(error)) throw error;
    setVisitorToken(null);
    return send(method, url, await issueToken(), data);
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
