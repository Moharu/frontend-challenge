import type { Eth, Network } from "./common";
import type { CartLine } from "./cart";
export interface Amounts {
  subtotalEth: Eth;
  discountEth: Eth;
  networkFeeEth: Eth;
  totalEth: Eth;
}
// The coupon is read from the cart and revalidated; it is not sent again.
export interface QuoteRequest {
  cartId: string;
  cartVersion: number;
  network: Network;
}
export interface Quote {
  id: string;
  version: number;
  cartVersion: number;
  expiresAt: string;
  items: CartLine[];
  coupon: string | null;
  amounts: Amounts;
  requiresConfirmation: boolean;
}
