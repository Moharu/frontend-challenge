import type { Network } from "@/contracts/common";
import { addEth, subtractEth } from "@/contracts/eth";
import type { Quote } from "@/contracts/quotes";
import { canonicalJson } from "@/contracts/orders";
import {
  validateWallet,
  type Wallet,
  type WalletConnection,
} from "@/contracts/wallets";
import type { AccountsState } from "./accounts";
import { activeSession } from "./accounts";
import { ApiError, viewCart, type StoredCart } from "./cart";
import { networkFees } from "./seed";
export interface StoredConnection extends WalletConnection {
  userId: string;
}
export interface StoredQuote {
  quote: Quote;
  userId: string;
  sequence: number;
}
export interface WalletsState extends AccountsState {
  wallets: Record<string, Wallet>;
  connections: Record<string, StoredConnection>;
  // Issued quotes (the latest 50) and the issuance counter: ids stay unique
  // across reloads.
  quotes: Record<string, StoredQuote>;
  quoteSequence: number;
}
// Quotes are short-lived: 2 minutes by the real clock. A scenario control
// shortens it to exercise the automatic renewal.
export const defaultQuoteTtlMs = 2 * 60 * 1000;
const userOf = (state: WalletsState, token: string | null) =>
  activeSession(state, token).userId;
export function listWallets(state: WalletsState, token: string | null) {
  const userId = userOf(state, token);
  return Object.values(state.wallets)
    .filter((w) => w.userId === userId)
    .sort((a, b) =>
      a.role === b.role
        ? a.id.localeCompare(b.id)
        : a.role === "primary"
          ? -1
          : 1,
    );
}
const optional = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;
export function createWallet(
  state: WalletsState,
  token: string | null,
  body: unknown,
): Wallet {
  const userId = userOf(state, token);
  const input = (body ?? {}) as Record<string, unknown>;
  const text = (key: string) =>
    typeof input[key] === "string" ? (input[key] as string) : "";
  const own = Object.values(state.wallets).filter((w) => w.userId === userId);
  const { fields, duplicate } = validateWallet(
    {
      address: text("address"),
      network: text("network"),
      provider: text("provider"),
      label: text("label"),
    },
    own,
  );
  // Only an address already registered is a conflict; everything else is a
  // validation error (other fields may fail alongside a duplicate).
  if (Object.keys(fields).length)
    throw new ApiError(
      duplicate ? 409 : 400,
      duplicate ? "CONFLICT" : "VALIDATION",
      "Revise os dados da carteira.",
      fields,
    );
  state.tick++;
  const wallet: Wallet = {
    id: `wallet-${state.tick}`,
    userId,
    address: text("address").trim(),
    network: text("network") as Network,
    provider: text("provider") as Wallet["provider"],
    // The first wallet of a user is the primary one; the next, secondary.
    role: own.some((w) => w.role === "primary") ? "secondary" : "primary",
    version: 1,
    label: text("label").trim(),
    displayName: optional(input.displayName),
    profileName: optional(input.profileName),
    referralCode: optional(input.referralCode),
    email: optional(input.email),
    ensName: optional(input.ensName),
    secondaryAddressOrEns: optional(input.secondaryAddressOrEns),
  };
  state.wallets[wallet.id] = wallet;
  return wallet;
}
// 404 for an unknown wallet, 403 for another user's wallet.
export function ownWallet(
  state: WalletsState,
  userId: string,
  walletId: unknown,
) {
  const wallet =
    typeof walletId === "string" ? state.wallets[walletId] : undefined;
  if (!wallet) throw new ApiError(404, "NOT_FOUND", "Carteira não encontrada.");
  if (wallet.userId !== userId)
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Esta carteira pertence a outra conta.",
    );
  return wallet;
}
const view = (connection: StoredConnection): WalletConnection => ({
  id: connection.id,
  walletId: connection.walletId,
  status: connection.status,
  createdAt: connection.createdAt,
});
// Approval or rejection is decided by the scenario controls before this runs.
export function connectWallet(
  state: WalletsState,
  token: string | null,
  body: unknown,
): WalletConnection {
  const userId = userOf(state, token);
  const wallet = ownWallet(
    state,
    userId,
    ((body ?? {}) as Record<string, unknown>).walletId,
  );
  // One active connection per user: connecting a wallet releases the others.
  for (const c of Object.values(state.connections))
    if (c.userId === userId && c.status === "active") c.status = "disconnected";
  state.tick++;
  const connection: StoredConnection = {
    id: `connection-${state.tick}`,
    walletId: wallet.id,
    userId,
    status: "active",
    createdAt: new Date().toISOString(),
  };
  state.connections[connection.id] = connection;
  return view(connection);
}
export function getConnection(
  state: WalletsState,
  token: string | null,
  id: string,
): WalletConnection {
  const userId = userOf(state, token);
  const connection = state.connections[id];
  if (!connection)
    throw new ApiError(404, "NOT_FOUND", "Conexão não encontrada.");
  if (connection.userId !== userId)
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Esta conexão pertence a outra conta.",
    );
  return view(connection);
}
// Scenario control: the wallet "disconnects" on the user's side.
export function disconnectAll(state: WalletsState) {
  for (const c of Object.values(state.connections)) c.status = "disconnected";
}
// Values compared between quotes (the version rule and order creation):
// lines (edition, quantity, prices), coupon, network and amounts.
export function quoteValues(quote: Quote) {
  return canonicalJson({
    items: quote.items.map((i) => ({
      nftId: i.nftId,
      editionId: i.editionId,
      quantity: i.quantity,
      unitPriceEth: i.unitPriceEth,
      lineTotalEth: i.lineTotalEth,
    })),
    coupon: quote.coupon?.code ?? null,
    network: quote.network,
    amounts: quote.amounts,
  });
}
// Issues and persists a quote. Every issuance gets a new id; the version
// follows the series (same user, cart and wallet) and increases only when
// the values differ from the series' previous quote.
export function issueQuote(
  state: WalletsState,
  token: string | null,
  cart: StoredCart,
  body: unknown,
  ttlMs: number,
): Quote {
  const userId = userOf(state, token);
  const fresh = computeQuote(state, token, cart, body);
  const previous = Object.values(state.quotes)
    .filter(
      (q) =>
        q.userId === userId &&
        q.quote.cartId === fresh.cartId &&
        q.quote.walletId === fresh.walletId,
    )
    .sort((a, b) => b.sequence - a.sequence)[0];
  state.quoteSequence++;
  const quote: Quote = {
    ...fresh,
    id: `quote-${state.quoteSequence}`,
    version: !previous
      ? 1
      : quoteValues(previous.quote) === quoteValues(fresh)
        ? previous.quote.version
        : previous.quote.version + 1,
    expiresAt: new Date(Date.now() + ttlMs).toISOString(),
  };
  state.quotes[quote.id] = {
    quote,
    userId,
    sequence: state.quoteSequence,
  };
  // Only the latest quotes are kept; older ones can no longer be ordered.
  const all = Object.values(state.quotes).sort(
    (a, b) => b.sequence - a.sequence,
  );
  for (const stale of all.slice(50)) delete state.quotes[stale.quote.id];
  return quote;
}
// The current quote for a cart and wallet, without persisting it: checks
// ownership, the active wallet connection, the cart version and current
// availability (never reducing quantities) and adds the fee of the wallet's
// network. Coupon validity and the discount come from viewCart
// (`couponStatus`), the same rule the cart shows.
export function computeQuote(
  state: WalletsState,
  token: string | null,
  cart: StoredCart,
  body: unknown,
): Quote {
  const userId = userOf(state, token);
  const input = (body ?? {}) as Record<string, unknown>;
  if (typeof input.cartId !== "string" || typeof input.cartVersion !== "number")
    throw new ApiError(400, "VALIDATION", "Informe o carrinho e a versão.");
  if (input.cartId !== cart.id)
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Este carrinho pertence a outra conta.",
    );
  const wallet = ownWallet(state, userId, input.walletId);
  if (
    !Object.values(state.connections).some(
      (c) => c.walletId === wallet.id && c.status === "active",
    )
  )
    throw new ApiError(
      409,
      "WALLET_DISCONNECTED",
      "A carteira foi desconectada. Conecte-a novamente para continuar.",
    );
  if (input.cartVersion !== cart.version)
    throw new ApiError(
      409,
      "CART_CHANGED",
      "O carrinho mudou desde a última cotação.",
    );
  const current = viewCart(state, cart);
  if (!current.items.length)
    throw new ApiError(409, "CART_CHANGED", "O carrinho está vazio.");
  const unavailable = current.items.filter((i) => i.conflict);
  if (unavailable.length)
    throw new ApiError(
      409,
      "UNAVAILABLE_ITEMS",
      "Alguns itens não estão mais disponíveis na quantidade escolhida.",
      Object.fromEntries(
        unavailable.map((i) => [
          i.id,
          i.conflict!.code === "SOLD_OUT"
            ? `${i.name} (${i.editionLabel}) esgotou.`
            : `${i.name} (${i.editionLabel}): disponível no máximo ${i.conflict!.maxQuantity}.`,
        ]),
      ),
    );
  const subtotal = current.summary.subtotalEth;
  const discount = current.summary.discountEth;
  const removed = current.couponRemoved;
  const fee = networkFees[wallet.network];
  return {
    id: "",
    version: 1,
    cartId: cart.id,
    cartVersion: cart.version,
    walletId: wallet.id,
    network: wallet.network,
    expiresAt: new Date().toISOString(),
    items: current.items,
    coupon: current.coupon,
    couponRemoved: removed,
    amounts: {
      subtotalEth: subtotal,
      discountEth: discount,
      networkFeeEth: fee,
      totalEth: addEth(subtractEth(subtotal, discount), fee),
    },
  };
}
