import type { Network } from "./common";
import { emailPattern, usernamePattern } from "./session";
import { ensNamePattern, validAddress, type WalletProvider } from "./wallets";

// Collector data for the order. The checkout form validates it now; order
// creation (which would send it) comes in the next stage.
export interface CheckoutCollectorData {
  displayName: string;
  username: string;
  email: string;
  profileName: string;
  referralCode?: string;
  ensName?: string;
  secondaryAddressOrEns?: string;
}
export const referralCodePattern = /^[A-Z0-9-]{4,20}$/;
export const collectorNoteMax = 500;
export const collectorTextMax = 60;
// Shared rules for the checkout form (and the future order endpoint). The
// ENS name is chosen from the user's wallets (a dropdown, as in the frame),
// so it needs no format rule; `secondaryAddressOrEns` accepts an address of
// the wallet's network or a full ENS name.
export function collectorErrors(
  input: {
    displayName: string;
    username: string;
    email: string;
    profileName: string;
    referralCode: string;
    ensName: string;
    secondaryAddressOrEns: string;
    note: string;
  },
  network: Network | null,
): Record<string, string> {
  const fields: Record<string, string> = {};
  const required = (key: "displayName" | "profileName", label: string) => {
    const value = input[key].trim();
    if (!value) fields[key] = `Informe ${label}.`;
    else if (value.length > collectorTextMax)
      fields[key] = `Use no máximo ${collectorTextMax} caracteres.`;
  };
  required("displayName", "o nome de exibição");
  if (!usernamePattern.test(input.username.trim().toLowerCase()))
    fields.username =
      "Use de 3 a 20 caracteres: letras sem acento, números ou _.";
  required("profileName", "o nome do perfil");
  if (!emailPattern.test(input.email.trim()))
    fields.email = "Informe um e-mail válido.";
  const referral = input.referralCode.trim();
  if (referral && !referralCodePattern.test(referral))
    fields.referralCode =
      "Use de 4 a 20 caracteres: letras maiúsculas, números ou hífen.";
  const secondary = input.secondaryAddressOrEns.trim();
  if (
    secondary &&
    !ensNamePattern.test(secondary) &&
    !(network && validAddress(network, secondary))
  )
    fields.secondaryAddressOrEns = network
      ? "Use um endereço válido para a rede da carteira ou um nome .eth."
      : "Use um nome .eth ou escolha a carteira para validar o endereço.";
  if (input.note.length > collectorNoteMax)
    fields.note = `Use no máximo ${collectorNoteMax} caracteres.`;
  return fields;
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
