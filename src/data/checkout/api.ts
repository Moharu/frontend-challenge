import { http } from "@/lib/http";
import { record } from "@/contracts/common";
import { isQuote, type Quote } from "@/contracts/quotes";
import {
  isWallet,
  isWalletConnection,
  type CreateWalletRequest,
  type Wallet,
  type WalletConnection,
} from "@/contracts/wallets";
import { getIdentity, identityHeaders } from "@/data/session/identity";
// Private checkout requests always carry the current session token; a 401
// SESSION_INVALID goes through the usual expiry flow (see identity.ts).
function headers() {
  return identityHeaders(getIdentity());
}
function data<T>(value: unknown, valid: (v: unknown) => v is T, what: string) {
  if (!record(value) || !valid(value.data))
    throw new Error(`Invalid ${what} response`);
  return value.data;
}
export async function getWallets(signal?: AbortSignal): Promise<Wallet[]> {
  const { data: value } = await http.get<unknown>("/wallets", {
    headers: headers(),
    signal,
  });
  return data(
    value,
    (v): v is Wallet[] => Array.isArray(v) && v.every(isWallet),
    "wallets",
  );
}
export async function createWallet(body: CreateWalletRequest) {
  const { data: value } = await http.post<unknown>("/wallets", body, {
    headers: headers(),
  });
  return data(value, isWallet, "wallet");
}
export async function connectWallet(
  walletId: string,
  signal?: AbortSignal,
): Promise<WalletConnection> {
  const { data: value } = await http.post<unknown>(
    "/wallet-connections",
    { walletId },
    { headers: headers(), signal },
  );
  return data(value, isWalletConnection, "wallet connection");
}
export async function getConnection(id: string): Promise<WalletConnection> {
  const { data: value } = await http.get<unknown>(
    `/wallet-connections/${encodeURIComponent(id)}`,
    { headers: headers() },
  );
  return data(value, isWalletConnection, "wallet connection");
}
export async function requestQuote(
  body: { cartId: string; cartVersion: number; walletId: string },
  signal?: AbortSignal,
): Promise<Quote> {
  const { data: value } = await http.post<unknown>("/quotes", body, {
    headers: headers(),
    signal,
  });
  return data(value, isQuote, "quote");
}
