import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Network } from "@/contracts/common";
import {
  networkNames,
  providerNames,
  validateWallet,
  walletProviders,
  type CreateWalletRequest,
  type UpdateWalletRequest,
  type Wallet,
} from "@/contracts/wallets";
import { apiError } from "@/lib/api-error";
import { createWallet } from "@/data/checkout/api";
import { updateWallet } from "@/data/account/api";
import { walletsKey, useWallets } from "@/data/checkout/hooks";
import { cartScope, getIdentity, sameScope } from "@/data/session/identity";
import { EnsField, SelectField, TextField } from "@/components/account/fields";
import { useFocusFirstError } from "@/lib/account-form";
export function WalletsPage() {
  const wallets = useWallets();
  if (wallets.isError)
    return (
      <section className="account-section">
        <h1 className="sr-only">Carteiras</h1>
        <div className="query-error" role="alert">
          <p>Não foi possível carregar suas carteiras.</p>
          <button
            className="button button-outline"
            onClick={() => void wallets.refetch()}
          >
            Tentar novamente
          </button>
        </div>
      </section>
    );
  if (!wallets.data)
    return (
      <section className="account-section">
        <h1 className="sr-only">Carteiras</h1>
        <p
          className="checkout-waiting py-[48px] px-[0] text-[color:var(--muted-foreground)]"
          role="status"
        >
          Carregando suas carteiras…
        </p>
      </section>
    );
  const primary = wallets.data.find((w) => w.role === "primary") ?? null;
  const secondary = wallets.data.find((w) => w.role === "secondary") ?? null;
  return (
    <section className="account-section account-wallets">
      <h1 className="sr-only">Carteiras</h1>
      <WalletSection
        key="primary"
        role="primary"
        wallet={primary}
        primary={primary}
      />
      <WalletSection
        key="secondary"
        role="secondary"
        wallet={secondary}
        primary={primary}
      />
    </section>
  );
}
type Values = Record<
  | "displayName"
  | "label"
  | "network"
  | "profileName"
  | "address"
  | "secondaryAddressOrEns"
  | "provider"
  | "referralCode"
  | "email"
  | "ensName",
  string
>;
const blank: Values = {
  displayName: "",
  label: "",
  network: "",
  profileName: "",
  address: "",
  secondaryAddressOrEns: "",
  provider: "",
  referralCode: "",
  email: "",
  ensName: "",
};
const valuesOf = (w: Wallet): Values => ({
  displayName: w.displayName ?? "",
  label: w.label ?? "",
  network: w.network,
  profileName: w.profileName ?? "",
  address: w.address,
  secondaryAddressOrEns: w.secondaryAddressOrEns ?? "",
  provider: w.provider,
  referralCode: w.referralCode ?? "",
  email: w.email ?? "",
  ensName: w.ensName ?? "",
});
// "Igual à carteira principal" copies the primary's descriptive fields only:
// never the address (it must be unique), nor network and type.
const descriptive = [
  "displayName",
  "profileName",
  "email",
  "ensName",
  "referralCode",
  "secondaryAddressOrEns",
] as const;
function WalletSection({
  role,
  wallet,
  primary,
}: {
  role: Wallet["role"];
  wallet: Wallet | null;
  primary: Wallet | null;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(wallet !== null);
  const [values, setValues] = useState<Values>(() =>
    wallet ? valuesOf(wallet) : blank,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const prefix = `wallet-${role}-`;
  const focusFirstError = useFocusFirstError(prefix);
  const title =
    role === "primary" ? "Carteira principal" : "Carteira secundária";
  // Without a primary wallet, a secondary one cannot be added yet (the first
  // wallet of a user is always the primary).
  const canAdd = !wallet && (role === "primary" || primary !== null);
  function fillFromPrimary() {
    if (!primary) return;
    setOpen(true);
    setValues((current) => {
      const next = { ...current };
      for (const key of descriptive) next[key] = valuesOf(primary)[key];
      return next;
    });
    setStatus(
      "Dados descritivos copiados da carteira principal. Informe o endereço e salve.",
    );
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    const { fields } = validateWallet(values, []);
    if (Object.keys(fields).length) {
      setErrors(fields);
      setStatus("");
      focusFirstError();
      return;
    }
    setSaving(true);
    setErrors({});
    // Cleared first, so the same result is announced again.
    setStatus("");
    const identity = getIdentity();
    const scope = cartScope(identity);
    try {
      let saved: Wallet;
      if (wallet) {
        const patch: UpdateWalletRequest = { version: wallet.version };
        const before = valuesOf(wallet);
        for (const key of Object.keys(values) as (keyof Values)[])
          if (values[key].trim() !== before[key])
            (patch as Record<string, unknown>)[key] =
              values[key].trim() || null;
        saved = await updateWallet(wallet.id, patch, identity);
      } else {
        const body = Object.fromEntries(
          Object.entries(values).filter(([, v]) => v.trim()),
        ) as unknown as CreateWalletRequest;
        saved = await createWallet(body);
      }
      if (!sameScope(scope, cartScope())) return;
      queryClient.setQueryData<Wallet[]>(walletsKey(scope), (current = []) =>
        current.some((w) => w.id === saved.id)
          ? current.map((w) => (w.id === saved.id ? saved : w))
          : [...current, saved],
      );
      setValues(valuesOf(saved));
      setStatus(`${title} salva.`);
    } catch (e) {
      const info = apiError(e);
      setErrors(info.fields);
      setStatus(`${title} não foi salva. ${info.message}`);
      focusFirstError();
    } finally {
      setSaving(false);
    }
  }
  const set = (key: keyof Values) => (value: string) =>
    setValues((v) => ({ ...v, [key]: value }));
  const headingId = `${prefix}title`;
  return (
    <section
      className="wallet-section grid gap-[24px]"
      aria-labelledby={headingId}
    >
      <div className="wallet-section-head flex gap-[16px] max-[701px]:flex-col">
        <div>
          <h2 id={headingId}>{title}</h2>
          {role === "primary" ? (
            <p>
              Estas carteiras ficam disponíveis no pagamento e para receber NFTs
              comprados.
            </p>
          ) : (
            !open && <p>Você ainda não adicionou uma carteira secundária.</p>
          )}
          {role === "primary" && !open && (
            <p>Você ainda não adicionou uma carteira principal.</p>
          )}
        </div>
        <div className="wallet-section-actions flex flex-wrap gap-y-[12px] gap-x-[16px]">
          {role === "secondary" && primary && (
            <button
              type="button"
              className="wallet-same flex items-center gap-[8px] text-[color:var(--foreground)]"
              onClick={fillFromPrimary}
            >
              <span
                className="wallet-same-mark w-[18px] h-[18px]"
                aria-hidden="true"
              />
              Igual à carteira principal
            </button>
          )}
          {canAdd && !open && (
            <button
              type="button"
              className="account-text-button wallet-add"
              aria-label={`Adicionar ${title.toLowerCase()}`}
              onClick={() => {
                setOpen(true);
                requestAnimationFrame(() =>
                  document.getElementById(`${prefix}displayName`)?.focus(),
                );
              }}
            >
              Adicionar
            </button>
          )}
        </div>
      </div>
      {open && (
        <form
          className="account-form"
          noValidate
          aria-labelledby={headingId}
          onSubmit={(e) => void save(e)}
        >
          <div className="account-grid grid grid-cols-[repeat(2,minmax(0,1fr))] gap-y-[22px] gap-x-[28px] max-[1001px]:grid-cols-[minmax(0,1fr)]">
            <TextField
              id={`${prefix}displayName`}
              label="Nome de exibição"
              value={values.displayName}
              onChange={set("displayName")}
              error={errors.displayName}
            />
            <TextField
              id={`${prefix}label`}
              label="Apelido da carteira"
              required
              value={values.label}
              onChange={set("label")}
              error={errors.label}
            />
            <SelectField
              id={`${prefix}network`}
              label="Rede"
              required
              placeholder="Selecione uma rede"
              value={values.network}
              onChange={set("network")}
              error={errors.network}
              options={(Object.keys(networkNames) as Network[]).map((n) => [
                n,
                networkNames[n],
              ])}
            />
            <TextField
              id={`${prefix}profileName`}
              label="Nome do perfil"
              value={values.profileName}
              onChange={set("profileName")}
              error={errors.profileName}
            />
            <TextField
              id={`${prefix}address`}
              label="Endereço da carteira"
              required
              placeholder="Endereço 0x da carteira"
              value={values.address}
              onChange={set("address")}
              error={errors.address}
            />
            <TextField
              id={`${prefix}secondaryAddressOrEns`}
              label="ENS ou carteira secundária"
              hiddenLabel
              placeholder="ENS ou carteira secundária (opcional)"
              value={values.secondaryAddressOrEns}
              onChange={set("secondaryAddressOrEns")}
              error={errors.secondaryAddressOrEns}
            />
            <SelectField
              id={`${prefix}provider`}
              label="Tipo de carteira"
              required
              placeholder="Selecione uma carteira"
              value={values.provider}
              onChange={set("provider")}
              error={errors.provider}
              options={walletProviders.map((p) => [p, providerNames[p]])}
            />
            <TextField
              id={`${prefix}referralCode`}
              label="Código de indicação"
              value={values.referralCode}
              onChange={set("referralCode")}
              error={errors.referralCode}
            />
            <TextField
              id={`${prefix}email`}
              label="E-mail"
              type="email"
              value={values.email}
              onChange={set("email")}
              error={errors.email}
            />
            <EnsField
              id={`${prefix}ensName`}
              value={values.ensName}
              onChange={set("ensName")}
              error={errors.ensName}
            />
          </div>
          <button
            type="submit"
            className="button button-primary account-save min-w-[130px] min-h-[40px] max-[701px]:w-[100%]"
            aria-disabled={saving}
          >
            {saving ? "Salvando…" : "Salvar carteira"}
          </button>
        </form>
      )}
      <p
        className="account-summary m-[0] text-[color:var(--muted-foreground)] leading-[1.6]"
        role="status"
      >
        {status}
      </p>
    </section>
  );
}
