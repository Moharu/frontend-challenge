import type { CheckoutCollectorData, OrderCheckoutSnapshot } from "./checkout";
import type { Amounts } from "./quotes";
import type { Eth, Network } from "./common";
export type OrderStatus = "pending" | "confirmed" | "declined";
// idempotencyKey is sent in the Idempotency-Key header, not duplicated in JSON.
export interface CreateOrderBody {
  quoteId: string;
  quoteVersion: number;
  walletId: string;
  network: Network;
  collector: CheckoutCollectorData;
  collectorNote?: string;
}
export interface CreateOrderRequest {
  idempotencyKey: string;
  body: CreateOrderBody;
}
export interface PurchasedItem {
  readonly nftId: string;
  readonly editionId: string;
  readonly name: string;
  readonly quantity: number;
  readonly unitPriceEth: Eth;
  readonly lineTotalEth: Eth;
}
export interface OrderReceipt extends OrderCheckoutSnapshot {
  readonly orderId: string;
  readonly confirmedAt: string;
  readonly transactionReference: string;
  readonly items: ReadonlyArray<PurchasedItem>;
  readonly amounts: Readonly<Amounts>;
}
export interface Order extends OrderCheckoutSnapshot {
  id: string;
  userId: string;
  version: number;
  status: OrderStatus;
  quoteId: string;
  quoteVersion: number;
  items: ReadonlyArray<PurchasedItem>;
  amounts: Readonly<Amounts>;
  createdAt: string;
  updatedAt: string;
  receipt: OrderReceipt | null;
  declineCode: string | null;
}
