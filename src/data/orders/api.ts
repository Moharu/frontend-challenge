import { http } from "@/lib/http";
import { record } from "@/contracts/common";
import {
  idempotencyHeader,
  isOrder,
  isReceipt,
  type CreateOrderBody,
  type Order,
  type OrderReceipt,
} from "@/contracts/orders";
import { getIdentity, identityHeaders } from "@/data/session/identity";
const headers = () => identityHeaders(getIdentity());
function data<T>(value: unknown, valid: (v: unknown) => v is T, what: string) {
  if (!record(value) || !valid(value.data))
    throw new Error(`Invalid ${what} response`);
  return value.data;
}
// Same key + same body returns the same order (201 created, 200 existing).
export async function createOrder(
  key: string,
  body: CreateOrderBody,
): Promise<Order> {
  const { data: value } = await http.post<unknown>("/orders", body, {
    headers: { ...headers(), [idempotencyHeader]: key },
  });
  return data(value, isOrder, "order");
}
export async function getOrder(
  id: string,
  signal?: AbortSignal,
): Promise<Order> {
  const { data: value } = await http.get<unknown>(
    `/orders/${encodeURIComponent(id)}`,
    { headers: headers(), signal },
  );
  return data(value, isOrder, "order");
}
export async function getReceipt(
  id: string,
  signal?: AbortSignal,
): Promise<OrderReceipt> {
  const { data: value } = await http.get<unknown>(
    `/orders/${encodeURIComponent(id)}/receipt`,
    { headers: headers(), signal },
  );
  return data(value, isReceipt, "receipt");
}
