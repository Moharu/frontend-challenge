import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Cart } from "@/contracts/cart";
import { compareEth, formatEth } from "@/contracts/eth";
import type { Quote } from "@/contracts/quotes";
import type {
  CreateWalletRequest,
  Wallet,
  WalletConnection,
} from "@/contracts/wallets";
import { apiError, type ApiErrorInfo } from "@/lib/api-error";
import {
  cartScope,
  sameScope,
  useIdentity,
  type CartScope,
} from "@/data/session/identity";
import {
  connectWallet,
  createWallet,
  getConnection,
  getWallets,
  requestQuote,
} from "./api";
// Wallets are private data in the same user + generation scope as the cart,
// so logout, expiry and user switches drop them (see identity.ts).
export const walletsKey = (scope: CartScope) => ["wallets", scope] as const;
export function useWallets() {
  const scope = cartScope(useIdentity());
  return useQuery({
    queryKey: walletsKey(scope),
    queryFn: ({ signal }) => getWallets(signal),
    enabled: scope?.kind === "user",
    retry: false,
  });
}
export function useCreateWallet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateWalletRequest) => {
      const scope = cartScope();
      const wallet = await createWallet(body);
      if (sameScope(scope, cartScope()))
        queryClient.setQueryData<Wallet[]>(walletsKey(scope), (current) =>
          current ? [...current, wallet] : [wallet],
        );
      return wallet;
    },
  });
}
export type ConnectionStatus =
  "idle" | "connecting" | "active" | "rejected" | "disconnected" | "error";
// Simulated connection of the selected wallet (no browser extension): choosing
// a wallet connects it; the server may reject it; a disconnection is detected
// through the API when checking, confirming and when the window regains focus.
export function useWalletConnection(walletId: string | null) {
  // Outcome of the attempt identified by `key` (wallet + attempt number);
  // while the current attempt has no outcome yet, the status is "connecting".
  const [attempt, setAttempt] = useState(0);
  const key = walletId ? `${walletId}:${attempt}` : null;
  const [outcome, setOutcome] = useState<{
    key: string;
    status: Exclude<ConnectionStatus, "idle" | "connecting">;
    error: string | null;
  } | null>(null);
  const connection = useRef<WalletConnection | null>(null);
  useEffect(() => {
    connection.current = null;
    if (!walletId || !key) return;
    const controller = new AbortController();
    connectWallet(walletId, controller.signal)
      .then((value) => {
        connection.current = value;
        setOutcome({ key, status: "active", error: null });
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        const info = apiError(e);
        setOutcome({
          key,
          status: info.code === "CONNECTION_REJECTED" ? "rejected" : "error",
          error: info.message,
        });
      });
    return () => controller.abort();
  }, [walletId, key]);
  const current = key && outcome?.key === key ? outcome : null;
  const status: ConnectionStatus = !key
    ? "idle"
    : (current?.status ?? "connecting");
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const markDisconnected = useCallback(() => {
    connection.current = null;
    if (key) setOutcome({ key, status: "disconnected", error: null });
  }, [key]);
  // Asks the API whether the connection is still active.
  const check = useCallback(async () => {
    const current = connection.current;
    if (!current) return false;
    try {
      const fresh = await getConnection(current.id);
      if (connection.current?.id !== current.id) return false;
      if (fresh.status === "active") return true;
      markDisconnected();
      return false;
    } catch {
      // A failed check is not a disconnection; the next one tells.
      return true;
    }
  }, [markDisconnected]);
  useEffect(() => {
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [check]);
  return {
    status,
    error: current?.error ?? null,
    retry,
    check,
    markDisconnected,
  };
}
const eth = (value: string) => `${formatEth(value)} ETH`;
// What changed between the quote the user saw and a new one, in words.
export function quoteChanges(shown: Quote, next: Quote): string[] {
  const changes: string[] = [];
  for (const line of shown.items) {
    const now = next.items.find((i) => i.id === line.id);
    const name = `${line.name} (${line.editionLabel})`;
    if (!now) changes.push(`${name} saiu do pedido.`);
    else {
      if (compareEth(line.unitPriceEth, now.unitPriceEth) !== 0)
        changes.push(
          `${name}: preço de ${eth(line.unitPriceEth)} para ${eth(now.unitPriceEth)}.`,
        );
      if (line.quantity !== now.quantity)
        changes.push(
          `${name}: quantidade de ${line.quantity} para ${now.quantity}.`,
        );
    }
  }
  for (const line of next.items)
    if (!shown.items.some((i) => i.id === line.id))
      changes.push(`${line.name} (${line.editionLabel}) entrou no pedido.`);
  if (shown.coupon && !next.coupon)
    changes.push(
      next.couponRemoved?.reason ??
        `O cupom ${shown.coupon.code} foi removido.`,
    );
  const amount = (label: string, before: string, after: string) => {
    if (compareEth(before, after) !== 0)
      changes.push(`${label}: de ${eth(before)} para ${eth(after)}.`);
  };
  amount("Desconto", shown.amounts.discountEth, next.amounts.discountEth);
  amount(
    "Taxa de rede",
    shown.amounts.networkFeeEth,
    next.amounts.networkFeeEth,
  );
  amount("Total", shown.amounts.totalEth, next.amounts.totalEth);
  return changes;
}
export interface PendingQuote {
  quote: Quote;
  changes: string[];
}
// Quote shown to the user and its revalidation. Changes the user makes
// (wallet, cart contents, coupon) give a new quote directly. Refreshes they
// did not cause (`nft.updated`, expiry, the check on "Confirmar compra")
// never swap the values silently: a different quote waits in `pending` until
// the user confirms it ("Revisei, confirmar com os novos valores").
export function useCheckoutQuote({
  cart,
  cartUpdatedAt,
  walletId,
  connected,
  onDisconnected,
}: {
  cart: Cart | null | undefined;
  cartUpdatedAt: number;
  walletId: string | null;
  connected: boolean;
  onDisconnected: () => void;
}) {
  const queryClient = useQueryClient();
  const [shown, setShown] = useState<Quote | null>(null);
  const [pending, setPending] = useState<PendingQuote | null>(null);
  const [error, setError] = useState<ApiErrorInfo | null>(null);
  const shownRef = useRef<Quote | null>(null);
  useEffect(() => {
    shownRef.current = shown;
  }, [shown]);
  const request = useRef<AbortController | null>(null);
  const key =
    cart && walletId && connected
      ? `${cart.id}:${cart.version}:${walletId}`
      : null;
  const fetchQuote = useCallback(
    async (
      mode: "accept" | "compare",
    ): Promise<"ok" | "changed" | "failed"> => {
      if (!cart || !walletId || !connected) return "failed";
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      try {
        const next = await requestQuote(
          { cartId: cart.id, cartVersion: cart.version, walletId },
          controller.signal,
        );
        if (controller.signal.aborted) return "failed";
        setError(null);
        const current = shownRef.current;
        if (mode === "accept") shownRef.current = next;
        const changes =
          mode === "compare" && current ? quoteChanges(current, next) : [];
        if (changes.length) {
          setPending({ quote: next, changes });
          return "changed";
        }
        setShown(next);
        setPending(null);
        return "ok";
      } catch (e) {
        if (controller.signal.aborted) return "failed";
        const info = apiError(e);
        if (info.code === "WALLET_DISCONNECTED") onDisconnected();
        else if (info.code === "CART_CHANGED")
          void queryClient.invalidateQueries({ queryKey: ["cart"] });
        setError(info);
        return "failed";
      } finally {
        if (request.current === controller) request.current = null;
      }
    },
    [cart, walletId, connected, onDisconnected, queryClient],
  );
  // A new cart version, wallet or connection: the user's own change.
  useEffect(() => {
    if (!key) {
      request.current?.abort();
      return;
    }
    // State is only set after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchQuote("accept");
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  // Same cart version refetched (catalog prices or availability changed).
  const lastUpdate = useRef(cartUpdatedAt);
  useEffect(() => {
    if (cartUpdatedAt === lastUpdate.current) return;
    lastUpdate.current = cartUpdatedAt;
    if (key && shownRef.current?.cartVersion === cart?.version)
      void fetchQuote("compare");
  }, [cartUpdatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  // An expired quote is renewed automatically, under the same comparison.
  useEffect(() => {
    if (!shown || !key) return;
    const wait = Math.max(0, Date.parse(shown.expiresAt) - Date.now());
    const id = window.setTimeout(() => void fetchQuote("compare"), wait);
    return () => window.clearTimeout(id);
  }, [shown, key, fetchQuote]);
  useEffect(() => () => request.current?.abort(), []);
  const acceptPending = useCallback(() => {
    setPending((current) => {
      if (current) setShown(current.quote);
      return null;
    });
  }, []);
  // A quote for another wallet or cart version is never shown, even briefly.
  const current =
    key &&
    shown &&
    shown.walletId === walletId &&
    shown.cartId === cart?.id &&
    shown.cartVersion === cart?.version
      ? shown
      : null;
  return {
    quote: current,
    pending: key ? pending : null,
    error: key ? error : null,
    revalidate: () => fetchQuote("compare"),
    acceptPending,
  };
}
