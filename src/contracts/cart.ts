import { integer, record, timestamp, type Eth, type Network } from "./common";
import { isEth } from "./eth";
import { networks } from "./nfts";
import type { Amounts } from "./quotes";
// A line is identified by NFT + edition. Prices are always the edition's
// current price; the API never lowers or removes a line on its own.
export type CartConflict =
  | { code: "SOLD_OUT"; maxQuantity: 0 }
  | { code: "QUANTITY_ABOVE_LIMIT"; maxQuantity: number };
export interface CartLine {
  id: string;
  nftId: string;
  editionId: string;
  nftVersion: number;
  name: string;
  artwork: string;
  tokenId: string;
  editionLabel: string;
  quantity: number;
  unitPriceEth: Eth;
  lineTotalEth: Eth;
  available: number;
  purchaseLimit: number;
  // min(available, purchaseLimit)
  maxQuantity: number;
  // Present while the current price differs from the last acknowledged one.
  priceChange: { previousEth: Eth; currentEth: Eth } | null;
  conflict: CartConflict | null;
}
export interface AppliedCoupon {
  code: string;
  description: string;
}
// Fee is estimated for the default network until checkout picks a wallet.
export interface CartSummary extends Amounts {
  feeNetwork: Network;
  feeEstimated: boolean;
}
export interface Cart {
  id: string;
  version: number;
  items: CartLine[];
  itemCount: number;
  coupon: AppliedCoupon | null;
  summary: CartSummary;
  hasConflicts: boolean;
  updatedAt: string;
}
export interface VisitorSession {
  token: string;
}
export interface AddCartItemRequest {
  nftId: string;
  editionId: string;
  quantity: number;
}
// Changing the quantity also acknowledges the current price. Sending
// acknowledgePriceEth alone acknowledges a change only if that is still the
// current price (409 otherwise).
export interface ChangeCartItemRequest {
  quantity?: number;
  acknowledgePriceEth?: Eth;
}
export interface ApplyCouponRequest {
  code: string;
}
export const visitorHeader = "X-Visitor-Token";
function isLine(value: unknown): value is CartLine {
  if (!record(value)) return false;
  const conflict = value.conflict;
  const change = value.priceChange;
  return (
    ["id", "nftId", "editionId", "name", "artwork", "tokenId", "editionLabel"]
      .map((k) => value[k])
      .every((v) => typeof v === "string" && v.length > 0) &&
    integer(value.nftVersion, 1) &&
    integer(value.quantity, 1) &&
    isEth(value.unitPriceEth) &&
    isEth(value.lineTotalEth) &&
    integer(value.available) &&
    integer(value.purchaseLimit, 1) &&
    integer(value.maxQuantity) &&
    (change === null ||
      (record(change) &&
        isEth(change.previousEth) &&
        isEth(change.currentEth))) &&
    (conflict === null ||
      (record(conflict) &&
        (conflict.code === "SOLD_OUT" ||
          conflict.code === "QUANTITY_ABOVE_LIMIT") &&
        integer(conflict.maxQuantity)))
  );
}
export function isCart(value: unknown): value is Cart {
  if (!record(value) || !record(value.summary)) return false;
  const s = value.summary;
  return (
    typeof value.id === "string" &&
    integer(value.version, 1) &&
    Array.isArray(value.items) &&
    value.items.every(isLine) &&
    integer(value.itemCount) &&
    (value.coupon === null ||
      (record(value.coupon) &&
        typeof value.coupon.code === "string" &&
        typeof value.coupon.description === "string")) &&
    isEth(s.subtotalEth) &&
    isEth(s.discountEth) &&
    isEth(s.networkFeeEth) &&
    isEth(s.totalEth) &&
    networks.includes(s.feeNetwork as Network) &&
    typeof s.feeEstimated === "boolean" &&
    typeof value.hasConflicts === "boolean" &&
    timestamp(value.updatedAt)
  );
}
