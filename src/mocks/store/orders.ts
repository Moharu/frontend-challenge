import { collectorErrors } from "@/contracts/checkout";
import { record } from "@/contracts/common";
import {
  canonicalJson,
  idempotencyKeyPattern,
  type Order,
  type OrderReceipt,
  type PurchasedItem,
} from "@/contracts/orders";
import type { Quote } from "@/contracts/quotes";
import { activeSession, accountCart } from "./accounts";
import { ApiError, logicalTime, type StoredCart } from "./cart";
import {
  computeQuote,
  issueQuote,
  ownWallet,
  quoteValues,
  type WalletsState,
} from "./wallets";
// How the simulated payment resolves, decided when the order is created so
// the result does not depend on which tab or reload resolves it.
export type PaymentOutcome =
  { status: "confirmed" } | { status: "declined"; reason: string };
export interface StoredOrder extends Order {
  // Real-clock time (ms) at which the payment resolves; persisted, so a
  // reload resolves overdue orders instead of losing the timer.
  resolveAt: number;
  outcome: PaymentOutcome;
  // The cart the order was created from: at most one pending order per cart.
  cartId?: string;
}
export interface OrdersState extends WalletsState {
  orders: Record<string, StoredOrder>;
  // `${userId}:${key}` -> the order created with that key and its body in
  // canonical JSON.
  idempotency: Record<string, { orderId: string; body: string }>;
  orderSequence: number;
}
// Thrown when the referenced quote is no longer valid: carries a fresh
// quote (already issued) for the client to show what changed.
export class QuoteChangedError extends ApiError {
  constructor(public quote: Quote) {
    super(
      409,
      "QUOTE_CHANGED",
      "Os valores do pedido mudaram desde a revisão. Confira e confirme novamente.",
    );
  }
}
// A new key for a cart that already has a pending order (another tab, for
// example): no second order, the client is sent to the existing one.
export class OrderPendingError extends ApiError {
  constructor(public orderId: string) {
    super(
      409,
      "ORDER_PENDING",
      "Já existe um pedido em andamento para este carrinho.",
    );
  }
}
export const view = (order: StoredOrder): Order => {
  const {
    resolveAt: _resolveAt,
    outcome: _outcome,
    cartId: _cartId,
    ...rest
  } = order;
  void _resolveAt;
  void _outcome;
  void _cartId;
  return structuredClone(rest);
};
const text = (value: unknown) => (typeof value === "string" ? value : "");
const orNull = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;
function nftChanged(state: WalletsState, nftId: string) {
  const nft = state.nfts.find((n) => n.id === nftId)!;
  state.tick++;
  nft.version++;
  nft.updatedAt = logicalTime(state.tick);
}
// Adds `delta` to an edition's availability (negative to reserve).
function adjustStock(
  state: WalletsState,
  items: ReadonlyArray<PurchasedItem>,
  sign: 1 | -1,
) {
  const changed = new Set<string>();
  for (const item of items) {
    const edition = state.nfts
      .find((n) => n.id === item.nftId)
      ?.editions.find((e) => e.id === item.editionId);
    if (!edition) continue;
    edition.available = Math.max(0, edition.available + sign * item.quantity);
    changed.add(item.nftId);
  }
  for (const nftId of changed) nftChanged(state, nftId);
  return [...changed];
}
export interface CreateOrderResult {
  order: Order;
  created: boolean;
  nftIds: string[];
}
// Idempotent order creation. The key is scoped per user and compared with
// the body in canonical form: same key and body return the same order (even
// after a lost response), same key with another body is a 409 conflict.
export function createOrder(
  state: OrdersState,
  token: string | null,
  key: string | null,
  body: unknown,
  options: {
    now: number;
    delayMs: number;
    outcome: PaymentOutcome;
    quoteTtlMs: number;
  },
): CreateOrderResult {
  const session = activeSession(state, token);
  const userId = session.userId;
  if (!key || !idempotencyKeyPattern.test(key))
    throw new ApiError(
      400,
      "VALIDATION",
      "Envie a chave de idempotência no cabeçalho Idempotency-Key.",
    );
  const scoped = `${userId}:${key}`;
  const canonical = canonicalJson(body);
  const previous = state.idempotency[scoped];
  if (previous) {
    if (previous.body !== canonical)
      throw new ApiError(
        409,
        "CONFLICT",
        "Esta chave de idempotência já foi usada para outro pedido.",
      );
    return {
      order: view(state.orders[previous.orderId]),
      created: false,
      nftIds: [],
    };
  }
  // After the key check (a retry with the same key and body still gets its
  // order): a cart has at most one pending order. Once it resolves, the cart
  // accepts a new one.
  const cart: StoredCart = accountCart(state, token);
  const pending = Object.values(state.orders).find(
    (o) => o.status === "pending" && o.cartId === cart.id,
  );
  if (pending) throw new OrderPendingError(pending.id);
  const input = record(body) ? body : {};
  const collector = record(input.collector) ? input.collector : {};
  if (
    typeof input.quoteId !== "string" ||
    typeof input.quoteVersion !== "number" ||
    typeof input.walletId !== "string"
  )
    throw new ApiError(
      400,
      "VALIDATION",
      "Informe a cotação, a versão e a carteira.",
    );
  const wallet = ownWallet(state, userId, input.walletId);
  // Same shared validators as the form.
  const fields = collectorErrors(
    {
      displayName: text(collector.displayName),
      username: text(collector.username),
      email: text(collector.email),
      profileName: text(collector.profileName),
      referralCode: text(collector.referralCode),
      ensName: text(collector.ensName),
      secondaryAddressOrEns: text(collector.secondaryAddressOrEns),
      note: text(input.collectorNote),
    },
    wallet.network,
  );
  if (Object.keys(fields).length)
    throw new ApiError(
      400,
      "VALIDATION",
      "Revise os dados do colecionador.",
      fields,
    );
  // The server recomputes the current quote and compares it with the one
  // the user confirmed (quoteId + quoteVersion).
  const fresh = computeQuote(state, token, cart, {
    cartId: cart.id,
    cartVersion: cart.version,
    walletId: wallet.id,
  });
  const stored = state.quotes[input.quoteId];
  const valid =
    stored &&
    stored.userId === userId &&
    stored.quote.version === input.quoteVersion &&
    Date.parse(stored.quote.expiresAt) > options.now &&
    stored.quote.walletId === wallet.id &&
    stored.quote.cartId === cart.id &&
    stored.quote.cartVersion === cart.version &&
    quoteValues(stored.quote) === quoteValues(fresh);
  if (!valid)
    throw new QuoteChangedError(
      issueQuote(
        state,
        token,
        cart,
        { cartId: cart.id, cartVersion: cart.version, walletId: wallet.id },
        options.quoteTtlMs,
      ),
    );
  const now = new Date(options.now).toISOString();
  state.orderSequence++;
  const items: PurchasedItem[] = fresh.items.map((line) => ({
    nftId: line.nftId,
    editionId: line.editionId,
    name: line.name,
    editionLabel: line.editionLabel,
    tokenId: line.tokenId,
    artwork: line.artwork,
    quantity: line.quantity,
    unitPriceEth: line.unitPriceEth,
    lineTotalEth: line.lineTotalEth,
  }));
  const order: StoredOrder = {
    id: `order-${state.orderSequence}`,
    userId,
    version: 1,
    status: "pending",
    quoteId: input.quoteId,
    quoteVersion: input.quoteVersion,
    items,
    amounts: { ...fresh.amounts, couponCode: fresh.coupon?.code ?? null },
    createdAt: now,
    updatedAt: now,
    receipt: null,
    declineCode: null,
    collector: {
      displayName: text(collector.displayName).trim(),
      username: text(collector.username).trim().toLowerCase(),
      email: text(collector.email).trim(),
      profileName: text(collector.profileName).trim(),
      referralCode: orNull(collector.referralCode),
      ensName: orNull(collector.ensName),
      secondaryAddressOrEns: orNull(collector.secondaryAddressOrEns),
    },
    wallet: {
      walletId: wallet.id,
      walletVersion: wallet.version,
      address: wallet.address,
      network: wallet.network,
      provider: wallet.provider,
    },
    collectorNote: orNull(input.collectorNote),
    resolveAt: options.now + options.delayMs,
    outcome: options.outcome,
    cartId: cart.id,
  };
  state.orders[order.id] = order;
  state.idempotency[scoped] = { orderId: order.id, body: canonical };
  // Reserve the quantities while the order is pending, so the same edition
  // is not sold twice; released if the payment is declined.
  const nftIds = adjustStock(state, items, -1);
  return { order: view(order), created: true, nftIds };
}
function randomHex(bytes: number) {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(values, (b) => b.toString(16).padStart(2, "0")).join("");
}
// Reduces the user's cart by exactly the purchased quantities, per edition:
// lines added or increased after the order was created keep the excess;
// lines that reach zero leave the cart.
function reduceCart(state: OrdersState, order: StoredOrder) {
  const account = state.accounts[order.userId];
  const cart = account && state.carts[account.cartId];
  if (!cart) return;
  for (const item of order.items) {
    const line = cart.items.find(
      (i) => i.nftId === item.nftId && i.editionId === item.editionId,
    );
    if (line) line.quantity -= item.quantity;
  }
  cart.items = cart.items.filter((i) => i.quantity > 0);
  state.tick++;
  cart.version++;
  cart.updatedAt = logicalTime(state.tick);
}
// Resolves every pending order whose time has come. A pending order is
// resolved once: the status check and the transition happen in the same
// serialized write, so a repeated trigger finds it terminal and does
// nothing. Terminal states never change again.
export function resolveDue(state: OrdersState, now: number) {
  const orders: Order[] = [];
  const nftIds = new Set<string>();
  for (const order of Object.values(state.orders)) {
    if (order.status !== "pending" || order.resolveAt > now) continue;
    const at = new Date(
      Math.max(now, Date.parse(order.updatedAt)),
    ).toISOString();
    order.version++;
    order.updatedAt = at;
    if (order.outcome.status === "confirmed") {
      order.status = "confirmed";
      const receipt: OrderReceipt = {
        orderId: order.id,
        confirmedAt: at,
        transactionReference: `0x${randomHex(32)}`,
        items: structuredClone(order.items),
        amounts: structuredClone(order.amounts),
        collector: structuredClone(order.collector),
        wallet: structuredClone(order.wallet),
        collectorNote: order.collectorNote,
      };
      order.receipt = receipt;
      // The reservation becomes the sale: availability stays reduced.
      reduceCart(state, order);
    } else {
      order.status = "declined";
      order.declineCode = order.outcome.reason;
      for (const id of adjustStock(state, order.items, 1)) nftIds.add(id);
    }
    orders.push(view(order));
  }
  return { orders, nftIds: [...nftIds] };
}
export function getOrder(
  state: OrdersState,
  token: string | null,
  id: string,
): Order {
  const userId = activeSession(state, token).userId;
  const order = state.orders[id];
  if (!order) throw new ApiError(404, "NOT_FOUND", "Pedido não encontrado.");
  if (order.userId !== userId)
    throw new ApiError(403, "FORBIDDEN", "Este pedido pertence a outra conta.");
  return view(order);
}
export function getReceipt(
  state: OrdersState,
  token: string | null,
  id: string,
): OrderReceipt {
  const order = getOrder(state, token, id);
  if (order.status !== "confirmed" || !order.receipt)
    throw new ApiError(
      409,
      "CONFLICT",
      order.status === "pending"
        ? "O pedido ainda aguarda confirmação."
        : "O pedido foi recusado e não tem recibo.",
    );
  return order.receipt;
}
