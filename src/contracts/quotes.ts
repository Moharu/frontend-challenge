import { integer, record, timestamp, type Eth, type Network } from "./common";
import { isCartLine, type AppliedCoupon, type CartLine } from "./cart";
import { isEth } from "./eth";
import { networkNames } from "./wallets";
export interface Amounts {
  subtotalEth: Eth;
  discountEth: Eth;
  networkFeeEth: Eth;
  totalEth: Eth;
}
// The network comes from the wallet on the server; the coupon is read from
// the cart and revalidated (including its expiry), never sent again.
export interface QuoteRequest {
  cartId: string;
  cartVersion: number;
  walletId: string;
}
export interface Quote {
  id: string;
  version: number;
  cartId: string;
  cartVersion: number;
  walletId: string;
  network: Network;
  // Short validity by the real clock (see `quoteTtlMs` in the mocks).
  expiresAt: string;
  items: CartLine[];
  coupon: AppliedCoupon | null;
  // The cart's coupon left out of this quote, with the reason.
  couponRemoved: { code: string; reason: string } | null;
  amounts: Amounts;
  // True when the user must confirm values different from what they saw in
  // the cart (a price changed since it was acknowledged, or the coupon left).
  requiresConfirmation: boolean;
}
export function isQuote(value: unknown): value is Quote {
  if (!record(value) || !record(value.amounts)) return false;
  const a = value.amounts;
  const removed = value.couponRemoved;
  return (
    typeof value.id === "string" &&
    integer(value.version, 1) &&
    typeof value.cartId === "string" &&
    integer(value.cartVersion, 1) &&
    typeof value.walletId === "string" &&
    typeof value.network === "string" &&
    value.network in networkNames &&
    timestamp(value.expiresAt) &&
    Array.isArray(value.items) &&
    value.items.every(isCartLine) &&
    (value.coupon === null ||
      (record(value.coupon) && typeof value.coupon.code === "string")) &&
    (removed === null ||
      (record(removed) &&
        typeof removed.code === "string" &&
        typeof removed.reason === "string")) &&
    isEth(a.subtotalEth) &&
    isEth(a.discountEth) &&
    isEth(a.networkFeeEth) &&
    isEth(a.totalEth) &&
    typeof value.requiresConfirmation === "boolean"
  );
}
