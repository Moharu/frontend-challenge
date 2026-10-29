import type { Network } from "./common";
import type { WalletProvider } from "./wallets";

// Somente contrato: não há formulário, validação ou criação de pedido.
export interface CheckoutCollectorData {
  displayName: string;
  username: string;
  email: string;
  profileName: string;
  referralCode?: string;
  ensName?: string;
  secondaryAddressOrEns?: string;
}
export interface CheckoutCollectorSnapshot {
  readonly displayName: string;
  readonly username: string;
  readonly email: string;
  readonly profileName: string;
  readonly referralCode: string | null;
  readonly ensName: string | null;
  readonly secondaryAddressOrEns: string | null;
}
// Endereço e provedor são resolvidos pela carteira cadastrada no backend simulado.
export interface OrderWalletSnapshot {
  readonly walletId: string;
  readonly walletVersion: number;
  readonly address: string;
  readonly network: Network;
  readonly provider: WalletProvider;
}
export interface OrderCheckoutSnapshot {
  readonly collector: Readonly<CheckoutCollectorSnapshot>;
  readonly wallet: Readonly<OrderWalletSnapshot>;
  readonly collectorNote: string | null;
}
