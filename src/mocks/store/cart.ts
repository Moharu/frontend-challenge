import type { Cart, CartLine } from "@/contracts/cart";
import type { ErrorCode } from "@/contracts/common";
import {
  addEth,
  compareEth,
  isEth,
  minEth,
  multiplyEth,
  percentOfEth,
  subtractEth,
} from "@/contracts/eth";
import type { Nft } from "@/contracts/nfts";
import { baseline, coupons, defaultFeeNetwork, networkFees } from "./seed";
export interface StoredCartItem {
  id: string;
  nftId: string;
  editionId: string;
  quantity: number;
  // Price last seen by the visitor (on add, quantity change or acknowledgment).
  acknowledgedPriceEth: string;
}
export interface StoredCart {
  id: string;
  version: number;
  items: StoredCartItem[];
  coupon: string | null;
  updatedAt: string;
}
export interface CommerceState {
  tick: number;
  nfts: Nft[];
  // Opaque visitor token -> cart id. A future login merges this cart.
  visitors: Record<string, { cartId: string; createdAt: string }>;
  carts: Record<string, StoredCart>;
}
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}
export const logicalTime = (tick: number) =>
  new Date(Date.parse(baseline) + tick * 1000).toISOString();
export const maxCartQuantity = 1000;
function edition(state: CommerceState, nftId: string, editionId: string) {
  const nft = state.nfts.find((n) => n.id === nftId);
  const found = nft?.editions.find((e) => e.id === editionId);
  if (!nft || !found)
    throw new ApiError(404, "NOT_FOUND", "NFT ou edição não encontrado.");
  return { nft, edition: found };
}
const maxQuantity = (e: { available: number; purchaseLimit: number }) =>
  Math.min(e.available, e.purchaseLimit);
export function cartFor(state: CommerceState, token: string | null) {
  const visitor = token ? state.visitors[token] : undefined;
  if (!visitor)
    throw new ApiError(
      401,
      "SESSION_INVALID",
      "Identificação de visitante ausente ou expirada.",
    );
  return state.carts[visitor.cartId];
}
export function viewCart(state: CommerceState, cart: StoredCart): Cart {
  const items = cart.items.map((item): CartLine => {
    const { nft, edition: e } = edition(state, item.nftId, item.editionId);
    const max = maxQuantity(e);
    return {
      id: item.id,
      nftId: nft.id,
      editionId: e.id,
      nftVersion: nft.version,
      name: nft.name,
      artwork: nft.artwork,
      tokenId: nft.tokenId,
      editionLabel: e.label,
      quantity: item.quantity,
      unitPriceEth: e.priceEth,
      lineTotalEth: multiplyEth(e.priceEth, item.quantity),
      available: e.available,
      purchaseLimit: e.purchaseLimit,
      maxQuantity: max,
      priceChange:
        compareEth(item.acknowledgedPriceEth, e.priceEth) !== 0
          ? { previousEth: item.acknowledgedPriceEth, currentEth: e.priceEth }
          : null,
      conflict:
        e.available === 0
          ? { code: "SOLD_OUT", maxQuantity: 0 }
          : item.quantity > max
            ? { code: "QUANTITY_ABOVE_LIMIT", maxQuantity: max }
            : null,
    };
  });
  const subtotal = addEth(...items.map((i) => i.lineTotalEth));
  const coupon = coupons.find((c) => c.code === cart.coupon) ?? null;
  const discount = !coupon
    ? "0"
    : "basisPoints" in coupon.discount
      ? percentOfEth(subtotal, coupon.discount.basisPoints)
      : minEth(coupon.discount.amountEth, subtotal);
  const fee = items.length ? networkFees[defaultFeeNetwork] : "0";
  return {
    id: cart.id,
    version: cart.version,
    items,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    coupon: coupon
      ? { code: coupon.code, description: coupon.description }
      : null,
    summary: {
      subtotalEth: subtotal,
      discountEth: discount,
      networkFeeEth: fee,
      totalEth: addEth(subtractEth(subtotal, discount), fee),
      feeNetwork: defaultFeeNetwork,
      feeEstimated: true,
    },
    hasConflicts: items.some((i) => i.conflict !== null),
    updatedAt: cart.updatedAt,
  };
}
function quantity(value: unknown) {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > maxCartQuantity
  )
    throw new ApiError(400, "VALIDATION", "Quantidade inválida.", {
      quantity: `Informe um número inteiro entre 1 e ${maxCartQuantity}.`,
    });
  return value;
}
function touch(state: CommerceState, cart: StoredCart) {
  state.tick++;
  cart.version++;
  cart.updatedAt = logicalTime(state.tick);
}
export function createVisitor(state: CommerceState, token: string) {
  state.tick++;
  const cartId = `cart-${state.tick}`;
  const now = logicalTime(state.tick);
  state.visitors[token] = { cartId, createdAt: now };
  state.carts[cartId] = {
    id: cartId,
    version: 1,
    items: [],
    coupon: null,
    updatedAt: now,
  };
}
export function addItem(state: CommerceState, cart: StoredCart, body: unknown) {
  const input = (body ?? {}) as Record<string, unknown>;
  if (typeof input.nftId !== "string" || typeof input.editionId !== "string")
    throw new ApiError(400, "VALIDATION", "Item inválido.", {
      editionId: "Informe o NFT e a edição.",
    });
  const amount = quantity(input.quantity);
  const { edition: e } = edition(state, input.nftId, input.editionId);
  const existing = cart.items.find(
    (i) => i.nftId === input.nftId && i.editionId === input.editionId,
  );
  const max = maxQuantity(e);
  const current = existing?.quantity ?? 0;
  if (e.available === 0)
    throw new ApiError(409, "CONFLICT", "Esta edição está esgotada.", {
      quantity: "Edição esgotada.",
    });
  if (current + amount > max)
    throw new ApiError(
      409,
      "CONFLICT",
      current
        ? `Você já tem ${current} no carrinho e o limite atual é ${max}. É possível adicionar no máximo ${Math.max(0, max - current)}.`
        : `O limite atual é ${max}.`,
      { quantity: String(Math.max(0, max - current)) },
    );
  if (existing) {
    existing.quantity += amount;
    existing.acknowledgedPriceEth = e.priceEth;
  } else
    cart.items.push({
      id: `item-${state.tick + 1}`,
      nftId: input.nftId,
      editionId: input.editionId,
      quantity: amount,
      acknowledgedPriceEth: e.priceEth,
    });
  touch(state, cart);
}
function item(cart: StoredCart, itemId: string) {
  const found = cart.items.find((i) => i.id === itemId);
  if (!found)
    throw new ApiError(404, "NOT_FOUND", "Item não encontrado no carrinho.");
  return found;
}
export function changeItem(
  state: CommerceState,
  cart: StoredCart,
  itemId: string,
  body: unknown,
) {
  const input = (body ?? {}) as Record<string, unknown>;
  const line = item(cart, itemId);
  const { edition: e } = edition(state, line.nftId, line.editionId);
  if (input.quantity === undefined && input.acknowledgePriceEth === undefined)
    throw new ApiError(400, "VALIDATION", "Nenhuma alteração informada.");
  if (input.acknowledgePriceEth !== undefined) {
    if (!isEth(input.acknowledgePriceEth))
      throw new ApiError(400, "VALIDATION", "Preço inválido.", {
        acknowledgePriceEth: "Informe o preço exibido.",
      });
    if (compareEth(input.acknowledgePriceEth, e.priceEth) !== 0)
      throw new ApiError(
        409,
        "CONFLICT",
        "O preço mudou novamente. Confira o valor atual.",
      );
  }
  if (input.quantity !== undefined) {
    const amount = quantity(input.quantity);
    const max = maxQuantity(e);
    if (amount > max)
      throw new ApiError(
        409,
        "CONFLICT",
        e.available === 0
          ? "Esta edição está esgotada. Remova o item."
          : `O limite atual é ${max}.`,
        { quantity: String(max) },
      );
    line.quantity = amount;
  }
  line.acknowledgedPriceEth = e.priceEth;
  touch(state, cart);
}
export function removeItem(
  state: CommerceState,
  cart: StoredCart,
  itemId: string,
) {
  const line = item(cart, itemId);
  cart.items = cart.items.filter((i) => i !== line);
  touch(state, cart);
}
export function applyCoupon(
  state: CommerceState,
  cart: StoredCart,
  body: unknown,
) {
  const raw = ((body ?? {}) as Record<string, unknown>).code;
  const code = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (!code)
    throw new ApiError(400, "VALIDATION", "Informe um código promocional.", {
      coupon: "Informe um código promocional.",
    });
  const coupon = coupons.find((c) => c.code === code);
  if (!coupon)
    throw new ApiError(400, "VALIDATION", "Cupom inexistente.", {
      coupon: "Este código promocional não existe.",
    });
  if (Date.parse(coupon.expiresAt) <= Date.parse(logicalTime(state.tick)))
    throw new ApiError(400, "VALIDATION", "Cupom expirado.", {
      coupon: "Este código promocional expirou.",
    });
  cart.coupon = coupon.code;
  touch(state, cart);
}
export function removeCoupon(state: CommerceState, cart: StoredCart) {
  cart.coupon = null;
  touch(state, cart);
}
