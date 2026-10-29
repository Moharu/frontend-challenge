import type { Network } from "./common";
export interface Wallet {
  id: string;
  userId: string;
  label: string;
  address: string;
  network: Network;
  role: "primary" | "secondary";
  version: number;
}
export type CreateWalletRequest = Pick<
  Wallet,
  "label" | "address" | "network" | "role"
>;
export type UpdateWalletRequest = CreateWalletRequest & { version: number };
