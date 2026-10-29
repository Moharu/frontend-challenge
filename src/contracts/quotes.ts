import type { Eth } from "./common";
import type { CartItem } from "./cart";
export interface Amounts {
  subtotalEth: Eth;
  discountEth: Eth;
  networkFeeEth: Eth;
  totalEth: Eth;
}
export interface QuoteRequest {
  cartId: string;
  cartVersion: number;
  coupon?: string;
  network: "ethereum" | "polygon";
}
export interface Quote {
  id: string;
  version: number;
  cartVersion: number;
  expiresAt: string;
  items: Array<CartItem & { nftVersion: number; available: number }>;
  coupon: string | null;
  amounts: Amounts;
  requiresConfirmation: boolean;
}
