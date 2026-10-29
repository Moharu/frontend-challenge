import { integer, record, timestamp, type Network } from "./common";
export type WalletProvider = "metamask" | "walletconnect" | "coinbase-wallet";
export const walletProviders: WalletProvider[] = [
  "metamask",
  "walletconnect",
  "coinbase-wallet",
];
export const providerNames: Record<WalletProvider, string> = {
  metamask: "MetaMask",
  walletconnect: "WalletConnect",
  "coinbase-wallet": "Coinbase Wallet",
};
export const networkNames: Record<Network, string> = {
  ethereum: "Ethereum",
  polygon: "Polygon",
  solana: "Solana",
};
export interface Wallet {
  id: string;
  userId: string;
  address: string;
  network: Network;
  provider: WalletProvider;
  role: "primary" | "secondary";
  version: number;
  displayName: string | null;
  label: string | null;
  profileName: string | null;
  referralCode: string | null;
  email: string | null;
  ensName: string | null;
  secondaryAddressOrEns: string | null;
}
// The role is decided by the server: the first wallet of a user becomes
// `primary`, the following ones `secondary` (at most one primary per user).
export interface CreateWalletRequest {
  address: string;
  network: Network;
  provider: WalletProvider;
  label: string;
  displayName?: string;
  profileName?: string;
  referralCode?: string;
  email?: string;
  ensName?: string;
  secondaryAddressOrEns?: string;
}
// Campos omitidos permanecem; null limpa apenas campos anuláveis.
export type UpdateWalletRequest = Partial<
  Omit<Wallet, "id" | "userId" | "version">
> & { version: number };
// Address formats per network: EVM hex for Ethereum/Polygon, base58 for Solana.
const evmAddress = /^0x[0-9a-fA-F]{40}$/;
const solanaAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export function validAddress(network: Network, address: string) {
  return network === "solana"
    ? solanaAddress.test(address)
    : evmAddress.test(address);
}
// ENS name: `[a-z0-9-]` labels (3 to 63 characters for the main one) ending
// in `.eth`, subdomains included (nova.kurio.eth).
export const ensNamePattern = /^([a-z0-9-]{1,63}\.)*[a-z0-9-]{3,63}\.eth$/;
// Addresses compare case-insensitively (EVM checksums are only a casing).
export const sameAddress = (a: string, b: string) =>
  a.toLowerCase() === b.toLowerCase();
export const walletLabelMax = 40;
type WalletInput = {
  address: string;
  network: string;
  provider: string;
  label: string;
};
// Shared by the simulated server and the form. `existing` are the user's
// current wallets, for the one-address-per-user rule. Messages are for
// display only; `duplicate` tells the conflict case apart explicitly, so the
// server's status (409 vs 400) never depends on the wording.
export function validateWallet(
  input: WalletInput,
  existing: Pick<Wallet, "address">[] = [],
): { fields: Record<string, string>; duplicate: boolean } {
  const fields: Record<string, string> = {};
  let duplicate = false;
  const network = input.network as Network;
  if (!(network in networkNames))
    fields.network = "Escolha a rede da carteira.";
  if (!walletProviders.includes(input.provider as WalletProvider))
    fields.provider = "Escolha o provedor da carteira.";
  const address = input.address.trim();
  if (!address) fields.address = "Informe o endereço da carteira.";
  else if (network in networkNames && !validAddress(network, address))
    fields.address =
      network === "solana"
        ? "Use um endereço Solana válido (base58, de 32 a 44 caracteres)."
        : "Use um endereço 0x seguido de 40 caracteres hexadecimais.";
  else if (existing.some((w) => sameAddress(w.address, address))) {
    duplicate = true;
    fields.address = "Esta carteira já está cadastrada na sua conta.";
  }
  const label = input.label.trim();
  if (!label) fields.label = "Dê um nome para identificar a carteira.";
  else if (label.length > walletLabelMax)
    fields.label = `Use no máximo ${walletLabelMax} caracteres.`;
  return { fields, duplicate };
}
// Field messages only (the form).
export const walletErrors = (
  input: WalletInput,
  existing: Pick<Wallet, "address">[] = [],
) => validateWallet(input, existing).fields;
// Display form of an address: 0xA91F…E82C.
export const shortAddress = (address: string) =>
  address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
const optionalText = (value: unknown) =>
  value === null || typeof value === "string";
export function isWallet(value: unknown): value is Wallet {
  return (
    record(value) &&
    typeof value.id === "string" &&
    typeof value.userId === "string" &&
    typeof value.address === "string" &&
    typeof value.network === "string" &&
    value.network in networkNames &&
    walletProviders.includes(value.provider as WalletProvider) &&
    (value.role === "primary" || value.role === "secondary") &&
    integer(value.version, 1) &&
    [
      "displayName",
      "label",
      "profileName",
      "referralCode",
      "email",
      "ensName",
      "secondaryAddressOrEns",
    ].every((key) => optionalText(value[key]))
  );
}
// Simulated wallet connection (no browser extension). `active` until the
// user, or a scenario control, disconnects it on the server.
export interface WalletConnection {
  id: string;
  walletId: string;
  status: "active" | "disconnected";
  createdAt: string;
}
export interface CreateWalletConnectionRequest {
  walletId: string;
}
export function isWalletConnection(value: unknown): value is WalletConnection {
  return (
    record(value) &&
    typeof value.id === "string" &&
    typeof value.walletId === "string" &&
    (value.status === "active" || value.status === "disconnected") &&
    timestamp(value.createdAt)
  );
}
