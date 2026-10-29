import type { Network } from "@/contracts/common";
import { addEth, minEth, percentOfEth, subtractEth } from "@/contracts/eth";
import type { Quote } from "@/contracts/quotes";
import {
  walletErrors,
  type Wallet,
  type WalletConnection,
} from "@/contracts/wallets";
import type { AccountsState } from "./accounts";
import { activeSession } from "./accounts";
import { ApiError, logicalTime, viewCart, type StoredCart } from "./cart";
import { coupons, networkFees } from "./seed";
export interface StoredConnection extends WalletConnection {
  userId: string;
}
export interface WalletsState extends AccountsState {
  wallets: Record<string, Wallet>;
  connections: Record<string, StoredConnection>;
  // Coupons expired by a scenario control (besides their own expiry date).
  expiredCoupons: string[];
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
  const fields = walletErrors(
    {
      address: text("address"),
      network: text("network"),
      provider: text("provider"),
      label: text("label"),
    },
    own,
  );
  if (Object.keys(fields).length)
    throw new ApiError(
      fields.address === "Esta carteira já está cadastrada na sua conta."
        ? 409
        : 400,
      fields.address === "Esta carteira já está cadastrada na sua conta."
        ? "CONFLICT"
        : "VALIDATION",
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
function ownWallet(state: WalletsState, userId: string, walletId: unknown) {
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
function couponState(state: WalletsState, code: string | null) {
  const coupon = coupons.find((c) => c.code === code);
  if (!coupon) return { coupon: null, removed: null };
  const expired =
    state.expiredCoupons.includes(coupon.code) ||
    Date.parse(coupon.expiresAt) <= Date.parse(logicalTime(state.tick));
  return expired
    ? {
        coupon: null,
        removed: {
          code: coupon.code,
          reason: `O cupom ${coupon.code} expirou e foi removido do pedido.`,
        },
      }
    : { coupon, removed: null };
}
// Server-side quote: checks ownership, the active wallet connection, the cart
// version and current availability (never reducing quantities), revalidates
// the coupon (including expiry) and adds the fee of the wallet's network.
export function createQuote(
  state: WalletsState,
  token: string | null,
  cart: StoredCart,
  body: unknown,
  ttlMs: number,
  sequence: number,
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
  const { coupon, removed } = couponState(state, cart.coupon);
  const discount = !coupon
    ? "0"
    : "basisPoints" in coupon.discount
      ? percentOfEth(subtotal, coupon.discount.basisPoints)
      : minEth(coupon.discount.amountEth, subtotal);
  const fee = networkFees[wallet.network];
  return {
    id: `quote-${sequence}`,
    version: 1,
    cartId: cart.id,
    cartVersion: cart.version,
    walletId: wallet.id,
    network: wallet.network,
    expiresAt: new Date(Date.now() + ttlMs).toISOString(),
    items: current.items,
    coupon: coupon
      ? { code: coupon.code, description: coupon.description }
      : null,
    couponRemoved: removed,
    amounts: {
      subtotalEth: subtotal,
      discountEth: discount,
      networkFeeEth: fee,
      totalEth: addEth(subtractEth(subtotal, discount), fee),
    },
    requiresConfirmation:
      removed !== null || current.items.some((i) => i.priceChange !== null),
  };
}
