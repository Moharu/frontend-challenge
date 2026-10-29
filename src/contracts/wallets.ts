import type { Network } from "./common";
export type WalletProvider = "metamask" | "walletconnect" | "coinbase-wallet";
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
export interface CreateWalletRequest {
  address: string;
  network: Network;
  provider: WalletProvider;
  role: Wallet["role"];
  displayName?: string;
  label?: string;
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
