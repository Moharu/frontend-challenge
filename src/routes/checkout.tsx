import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import type { Cart } from "@/contracts/cart";
import { collectorErrors, collectorNoteMax } from "@/contracts/checkout";
import type { Network } from "@/contracts/common";
import { compareEth, formatEth } from "@/contracts/eth";
import type { Quote } from "@/contracts/quotes";
import {
  networkNames,
  providerNames,
  shortAddress,
  walletErrors,
  walletProviders,
  type Wallet,
  type WalletProvider,
} from "@/contracts/wallets";
import { applyCoupon, removeCoupon } from "@/data/cart/api";
import { useCart, useCartMutation } from "@/data/cart/hooks";
import { loadDraft, saveDraft } from "@/data/checkout/draft";
import { createOrder } from "@/data/orders/api";
import {
  discardPendingOrder,
  loadPendingOrder,
  markPendingOrderCreated,
  pendingOrderFor,
} from "@/data/orders/pending";
import type { CreateOrderBody } from "@/contracts/orders";
import { isQuote } from "@/contracts/quotes";
import {
  useCheckoutQuote,
  useCreateWallet,
  useWalletConnection,
  useWallets,
} from "@/data/checkout/hooks";
import { useIdentity } from "@/data/session/identity";
import { notify } from "@/data/session/notices";
import { apiError } from "@/lib/api-error";
import { discoverySearch } from "@/lib/discovery-search";
import { checkoutSteps, type CheckoutStep } from "@/lib/checkout-search";
import type { Session } from "@/contracts/session";
import { Unavailable } from "@/components/discovery/shared";
import { artImage, asset } from "@/components/discovery/assets";
const eth = (value: string) => `${formatEth(value)} ETH`;
// Same breakpoint as the login: up to 700px the checkout is the mobile flow
// in three steps; above it (768px included), the desktop single page.
const mobileQuery = "(max-width: 700px)";
function useMobile() {
  return useSyncExternalStore(
    (change) => {
      const list = window.matchMedia(mobileQuery);
      list.addEventListener("change", change);
      return () => list.removeEventListener("change", change);
    },
    () => window.matchMedia(mobileQuery).matches,
  );
}
type FieldName =
  | "displayName"
  | "username"
  | "profileName"
  | "email"
  | "referralCode"
  | "ensName"
  | "secondaryAddressOrEns"
  | "note";
const fieldOrder: FieldName[] = [
  "displayName",
  "username",
  "profileName",
  "email",
  "secondaryAddressOrEns",
  "referralCode",
  "ensName",
  "note",
];
// Pre-fill: the selected wallet's descriptive data first, then the account.
// Only fields the user has not typed in are filled (typed values, even
// empty ones, live in the draft and always win).
function prefill(
  name: FieldName,
  wallet: Wallet | null,
  session: Session,
): string {
  const user = session.user;
  switch (name) {
    case "displayName":
      return wallet?.displayName ?? user.displayName ?? "";
    case "username":
      return user.username;
    case "email":
      return wallet?.email ?? user.email;
    case "profileName":
      return wallet?.profileName ?? "";
    case "referralCode":
      return wallet?.referralCode ?? "";
    case "ensName":
      return wallet?.ensName ?? "";
    case "secondaryAddressOrEns":
      return wallet?.secondaryAddressOrEns ?? "";
    default:
      return "";
  }
}
export function CheckoutPage() {
  const identity = useIdentity();
  useEffect(() => {
    document.title = "Pagamento | KURIO";
    return () => {
      document.title = "KURIO | Marketplace de NFTs";
    };
  }, []);
  // After an expiry the login opens over this page; the draft stays stored
  // and the form comes back filled once the same user signs in again.
  if (!identity.session)
    return (
      <main id="main" className="checkout-page">
        <p className="checkout-waiting">Entre novamente para continuar.</p>
      </main>
    );
  return <Checkout key={identity.session.user.id} session={identity.session} />;
}
function Checkout({ session }: { session: Session }) {
  const userId = session.user.id;
  const mobile = useMobile();
  const navigate = useNavigate();
  const { step } = useSearch({ from: "/checkout" });
  const cart = useCart();
  const wallets = useWallets();
  const [draft, setDraft] = useState(
    () => loadDraft(userId) ?? { fields: {}, walletId: null },
  );
  useEffect(() => saveDraft(userId, draft), [userId, draft]);
  const list = wallets.data ?? [];
  const wallet =
    list.find((w) => w.id === draft.walletId) ??
    (draft.walletId === null
      ? (list.find((w) => w.role === "primary") ?? list[0] ?? null)
      : null);
  const walletId = wallet?.id ?? null;
  const connection = useWalletConnection(walletId);
  const connected = connection.status === "active";
  const quote = useCheckoutQuote({
    cart: cart.data,
    cartUpdatedAt: cart.dataUpdatedAt,
    walletId,
    connected,
    onDisconnected: connection.markDisconnected,
  });
  const value = (name: FieldName) =>
    draft.fields[name] ?? prefill(name, wallet, session);
  const values = Object.fromEntries(
    fieldOrder.map((name) => [name, value(name)]),
  ) as Record<FieldName, string>;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const setField = (name: FieldName, next: string) => {
    setDraft((d) => ({ ...d, fields: { ...d.fields, [name]: next } }));
    if (errors[name])
      setErrors((current) => {
        const rest = { ...current };
        delete rest[name];
        return rest;
      });
  };
  const selectWallet = (id: string) =>
    setDraft((d) => ({ ...d, walletId: id }));
  const validate = () =>
    collectorErrors(values, (wallet?.network as Network | undefined) ?? null);
  // Preconditions: an empty cart, or one with conflicts, does not open the
  // checkout; the cart explains what to fix.
  const blocked =
    cart.isSuccess &&
    (!cart.data || cart.data.items.length === 0 || cart.data.hasConflicts);
  useEffect(() => {
    if (!blocked) return;
    notify(
      !cart.data || cart.data.items.length === 0
        ? "Seu carrinho está vazio. Adicione um NFT para finalizar a compra."
        : "Resolva os itens indisponíveis ou acima do limite antes de finalizar a compra.",
    );
    void navigate({ to: "/cart", replace: true });
  }, [blocked, cart.data, navigate]);
  // Mobile steps: a step after an invalid one is not shown; the URL goes
  // back to the first step that needs attention.
  const collectorValid = Object.keys(validate()).length === 0;
  const effectiveStep: CheckoutStep = !mobile
    ? "dados"
    : step !== "dados" && !collectorValid
      ? "dados"
      : step === "revisao" && !walletId
        ? "carteira"
        : step;
  useEffect(() => {
    if (mobile && effectiveStep !== step && wallets.isSuccess)
      void navigate({
        to: "/checkout",
        search: { step: effectiveStep },
        replace: true,
      });
  }, [mobile, effectiveStep, step, navigate, wallets.isSuccess]);
  const goStep = (next: CheckoutStep) =>
    void navigate({ to: "/checkout", search: { step: next } });
  const focusFirstError = (found: Record<string, string>) => {
    const name = fieldOrder.find((key) => found[key]);
    if (name) document.getElementById(`checkout-${name}`)?.focus();
  };
  const [confirming, setConfirming] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendingOrder, setSendingOrder] = useState(false);
  const sending = useRef(false);
  // The order body: the quote just validated, the wallet and the collector
  // data (optional fields omitted when empty).
  const orderBody = (validated: Quote): CreateOrderBody => {
    const optional = (v: string) => (v.trim() ? v.trim() : undefined);
    return {
      quoteId: validated.id,
      quoteVersion: validated.version,
      walletId: validated.walletId,
      collector: {
        displayName: values.displayName.trim(),
        username: values.username.trim(),
        email: values.email.trim(),
        profileName: values.profileName.trim(),
        referralCode: optional(values.referralCode),
        ensName: optional(values.ensName),
        secondaryAddressOrEns: optional(values.secondaryAddressOrEns),
      },
      collectorNote: optional(values.note),
    };
  };
  // Sends the order with the idempotency key for this body: the stored one on
  // a retry (refresh, timeout), a new one when the body changed. The button
  // is disabled while sending, but idempotency is the actual guarantee.
  async function sendOrder(body: CreateOrderBody, retried = false) {
    if (sending.current) return;
    sending.current = true;
    setSendingOrder(true);
    setSendError(null);
    const pending = pendingOrderFor(userId, body);
    try {
      const order = await createOrder(pending.key, body);
      markPendingOrderCreated(userId, order.id);
      // Replace: going back must not send the purchase again.
      await navigate({
        to: "/orders/$orderId",
        params: { orderId: order.id },
        replace: true,
      });
    } catch (e) {
      const info = apiError(e);
      if (info.code === "QUOTE_CHANGED") {
        // A new confirmation sends a different body, with a new key.
        discardPendingOrder(userId);
        const fresh = isQuote(info.quote) ? info.quote : null;
        if (fresh && quote.offer(fresh))
          notify("Os valores do pedido mudaram. Revise antes de confirmar.");
        else if (fresh && !retried) {
          // Same values (only the quote's validity changed): nothing new to
          // confirm, so it is sent once more with the fresh quote.
          sending.current = false;
          await sendOrder(orderBody(fresh), true);
          return;
        } else setSendError(info.message);
      } else if (info.code === "ORDER_PENDING" && info.orderId) {
        // Another tab (another key) already ordered this cart: this tab's key
        // goes, and the user follows the existing order.
        discardPendingOrder(userId);
        await navigate({
          to: "/orders/$orderId",
          params: { orderId: info.orderId },
          replace: true,
        });
        notify("Já existe um pedido em andamento para este carrinho.");
      } else if (info.status === 400 && Object.keys(info.fields).length) {
        discardPendingOrder(userId);
        setErrors(info.fields);
        if (mobile) goStep("dados");
        requestAnimationFrame(() => focusFirstError(info.fields));
      } else if (info.status === 409 && info.code === "CONFLICT") {
        // Same key with another body: never expected in the normal flow.
        discardPendingOrder(userId);
        setSendError(
          "Não foi possível enviar o pedido com estes dados. Revise e confirme novamente.",
        );
      } else if (info.status === 0 || info.status >= 500) {
        // Timeout or network failure: the order may exist. The retry reuses
        // the same key and gets the order already created, if any.
        setSendError("Não foi possível confirmar o envio do pedido.");
      } else {
        discardPendingOrder(userId);
        setSendError(info.message);
      }
    } finally {
      sending.current = false;
      setSendingOrder(false);
    }
  }
  // Retrying an unresolved send resends the stored body (same key): a new
  // revalidation would issue a new quote id, hence another body and key.
  const retrySend = () => {
    const stored = unresolved();
    if (stored) void sendOrder(stored.body);
  };
  // A send whose answer was never seen (refresh during the request, lost
  // response) resumes with the same key and leads to the order page. Once
  // the order id is known, the key is kept only until a terminal state is
  // seen, and a new purchase gets its own key.
  const unresolved = () => {
    const stored = loadPendingOrder(userId);
    return stored && !stored.orderId ? stored : null;
  };
  const [resuming] = useState(unresolved);
  useEffect(() => {
    if (resuming) void sendOrder(resuming.body);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function confirm() {
    if (confirming || !quote.quote || !connected) return;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) {
      if (mobile) goStep("dados");
      requestAnimationFrame(() => focusFirstError(found));
      return;
    }
    // A send still unresolved (timeout) is retried as is, never re-quoted.
    const stored = unresolved();
    if (stored) {
      await sendOrder(stored.body);
      return;
    }
    setConfirming(true);
    try {
      // A disconnection shows (and is announced) in the connection status.
      if (!(await connection.check())) return;
      const result = await quote.revalidate();
      if (result.status === "changed")
        notify("Os valores do pedido mudaram. Revise antes de confirmar.");
      if (result.status === "ok") await sendOrder(orderBody(result.quote));
    } finally {
      setConfirming(false);
    }
  }
  async function confirmNewValues() {
    quote.acceptPending();
    // The accepted values are confirmed through the same final check.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await confirm();
  }
  if (cart.isPending || wallets.isPending || blocked)
    return (
      <main id="main" className="checkout-page" aria-busy="true">
        <p className="checkout-waiting" role="status">
          Carregando o pagamento…
        </p>
      </main>
    );
  if (cart.isError || wallets.isError || !cart.data)
    return (
      <main id="main" className="checkout-page">
        <section className="query-error" role="alert">
          <h1>Não foi possível carregar o pagamento</h1>
          <p>Ocorreu uma falha de conexão. Tente novamente.</p>
          <button
            className="button button-primary"
            onClick={() => {
              void cart.refetch();
              void wallets.refetch();
            }}
          >
            Tentar novamente
          </button>
        </section>
      </main>
    );
  const shared = {
    cart: cart.data,
    quote,
    wallet,
    wallets: list,
    connection,
    selectWallet,
    confirming: confirming || sendingOrder,
    sendError,
    onRetrySend: retrySend,
    onConfirm: () => void confirm(),
    onConfirmNew: () => void confirmNewValues(),
  };
  const collector = (beforeNote?: ReactNode) => (
    <CollectorFields
      values={values}
      errors={errors}
      onChange={setField}
      wallet={wallet}
      wallets={list}
      beforeNote={beforeNote}
    />
  );
  return (
    <main id="main" className="checkout-page">
      {resuming && sendingOrder && (
        <p className="checkout-resuming" role="status">
          Retomando seu pedido…
        </p>
      )}
      {mobile ? (
        <MobileCheckout
          step={effectiveStep}
          title={
            effectiveStep === "dados"
              ? "Dados do colecionador"
              : effectiveStep === "carteira"
                ? "Pagamento com carteira"
                : "Revisão do pedido"
          }
          onBack={() =>
            effectiveStep === "dados"
              ? void navigate({ to: "/cart" })
              : goStep(effectiveStep === "revisao" ? "carteira" : "dados")
          }
        >
          {effectiveStep === "dados" && (
            <form
              className="checkout-form"
              aria-label="Dados do colecionador"
              noValidate
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                const found = validate();
                setErrors(found);
                if (Object.keys(found).length) focusFirstError(found);
                else goStep("carteira");
              }}
            >
              {collector()}
              <div className="checkout-fixed">
                <button type="submit" className="button button-primary">
                  Continuar
                </button>
              </div>
            </form>
          )}
          {effectiveStep === "carteira" && (
            <>
              <WalletCards {...shared} />
              <ProviderGroup {...shared} mobile />
              <ConnectionStatus connection={connection} wallet={wallet} />
              <p className="checkout-mobile-total">
                Total:{" "}
                <strong>
                  {quote.quote ? eth(quote.quote.amounts.totalEth) : "—"}
                </strong>
              </p>
              <div className="checkout-fixed">
                <button
                  className="button button-primary"
                  aria-disabled={!connected}
                  aria-describedby={connected ? undefined : "connection-status"}
                  onClick={() => connected && goStep("revisao")}
                >
                  Continuar
                </button>
              </div>
            </>
          )}
          {effectiveStep === "revisao" && (
            <>
              <OrderItems cart={cart.data} quote={quote.quote} />
              <CouponField cart={cart.data} />
              <Amounts quote={quote.quote} />
              {wallet && (
                <p className="checkout-review-wallet">
                  Carteira: <strong>{wallet.label ?? "Carteira"}</strong> ·{" "}
                  {providerNames[wallet.provider]} · Rede{" "}
                  {networkNames[wallet.network]}
                </p>
              )}
              <ConnectionStatus connection={connection} wallet={wallet} />
              <QuoteNotices {...shared} />
              <div className="checkout-fixed">
                <ConfirmButton {...shared} />
              </div>
            </>
          )}
        </MobileCheckout>
      ) : (
        <>
          <nav className="breadcrumbs" aria-label="Trilha">
            <Link to="/" search={discoverySearch({})}>
              Início
            </Link>{" "}
            /{" "}
            <Link to="/" search={discoverySearch({})} hash="catalogo">
              Mercado
            </Link>{" "}
            / <span aria-current="page">Pagamento</span>
          </nav>
          <h1 className="sr-only">Pagamento</h1>
          <div className="checkout-layout">
            <section
              className="checkout-collector"
              aria-labelledby="collector-title"
            >
              <h2 id="collector-title">Perfil do colecionador</h2>
              {collector(<OtherWallets {...shared} />)}
            </section>
            <aside className="checkout-summary" aria-labelledby="items-title">
              <h2 id="items-title">Seus NFTs</h2>
              <OrderItems cart={cart.data} quote={quote.quote} />
              <CouponField cart={cart.data} />
              <Amounts quote={quote.quote} />
              <ProviderGroup {...shared} />
              <ConnectionStatus connection={connection} wallet={wallet} />
              <QuoteNotices {...shared} />
              <ConfirmButton {...shared} />
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
function MobileCheckout({
  step,
  title,
  onBack,
  children,
}: {
  step: CheckoutStep;
  title: string;
  onBack: () => void;
  children: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  // Moving between steps moves focus to the new step's heading.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    heading.current?.focus();
  }, [step]);
  return (
    <div className="checkout-mobile">
      <header className="checkout-mobile-header">
        <button className="cart-back" aria-label="Voltar" onClick={onBack}>
          <img src={asset("mobile-detail-ArrowLeft2.svg")} alt="" />
        </button>
        <h1 ref={heading} tabIndex={-1}>
          {title}
        </h1>
      </header>
      <p className="checkout-step" aria-live="off">
        Passo {checkoutSteps.indexOf(step) + 1} de 3
      </p>
      {children}
    </div>
  );
}
function Field({
  name,
  label,
  value,
  error,
  onChange,
  required = false,
  placeholder,
  hint,
  children,
  type = "text",
  autoComplete,
  hiddenLabel = false,
}: {
  name: FieldName;
  label: string;
  value: string;
  error?: string;
  onChange: (name: FieldName, value: string) => void;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  children?: ReactNode;
  type?: string;
  autoComplete?: string;
  hiddenLabel?: boolean;
}) {
  const id = `checkout-${name}`;
  const described =
    [hint ? `${id}-hint` : "", error ? `${id}-error` : ""]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <div
      className={`checkout-field${hiddenLabel ? " checkout-unlabeled" : ""}`}
    >
      <label htmlFor={id} className={hiddenLabel ? "sr-only" : undefined}>
        {label}
        {required && (
          <span className="required" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <div className={children ? "checkout-input-suffix" : undefined}>
        <input
          id={id}
          name={name}
          type={type}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          onChange={(e) => onChange(name, e.target.value)}
        />
        {children}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="auth-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="auth-error">
          {error}
        </p>
      )}
    </div>
  );
}
// Network, wallet type and address belong to the selected wallet (the server
// resolves them from walletId): read-only here, updated by changing wallets.
function ReadOnly({
  label,
  value,
  id,
}: {
  label: string;
  value: string;
  id: string;
}) {
  return (
    <div className="checkout-field">
      <label htmlFor={id}>
        {label}
        <span className="required" aria-hidden="true">
          *
        </span>
      </label>
      <input id={id} value={value} readOnly className="checkout-readonly" />
    </div>
  );
}
// `beforeNote`: rendered between the fields and the note, where the desktop
// frame places "Usar outra carteira?".
function CollectorFields({
  values,
  errors,
  onChange,
  wallet,
  wallets,
  beforeNote,
}: {
  values: Record<FieldName, string>;
  errors: Record<string, string>;
  onChange: (name: FieldName, value: string) => void;
  wallet: Wallet | null;
  wallets: Wallet[];
  beforeNote?: ReactNode;
}) {
  const none = "Escolha uma carteira";
  const ensNames = [
    ...new Set(wallets.flatMap((w) => (w.ensName ? [w.ensName] : []))),
  ];
  return (
    <div className="checkout-fields">
      <Field
        name="displayName"
        label="Nome de exibição"
        required
        autoComplete="name"
        value={values.displayName}
        error={errors.displayName}
        onChange={onChange}
      />
      <Field
        name="username"
        label="Nome de usuário"
        required
        autoComplete="username"
        value={values.username}
        error={errors.username}
        onChange={onChange}
      />
      <ReadOnly
        id="checkout-network"
        label="Rede"
        value={wallet ? networkNames[wallet.network] : none}
      />
      <Field
        name="profileName"
        label="Nome do perfil"
        required
        value={values.profileName}
        error={errors.profileName}
        onChange={onChange}
      />
      <ReadOnly
        id="checkout-address"
        label="Endereço da carteira"
        value={wallet ? wallet.address : none}
      />
      <Field
        name="secondaryAddressOrEns"
        label="ENS ou carteira secundária"
        hiddenLabel
        placeholder="ENS ou carteira secundária (opcional)"
        value={values.secondaryAddressOrEns}
        error={errors.secondaryAddressOrEns}
        onChange={onChange}
      />
      <ReadOnly
        id="checkout-provider"
        label="Tipo de carteira"
        value={wallet ? providerNames[wallet.provider] : none}
      />
      <Field
        name="referralCode"
        label="Código de indicação"
        value={values.referralCode}
        error={errors.referralCode}
        onChange={(name, v) => onChange(name, v.toUpperCase())}
      />
      <Field
        name="email"
        label="E-mail"
        type="email"
        required
        autoComplete="email"
        value={values.email}
        error={errors.email}
        onChange={onChange}
      />
      {/* Nome ENS is a dropdown in the frame: ".eth" (none) or one of the ENS
          names of the user's wallets. */}
      <div className="checkout-field">
        <label htmlFor="checkout-ensName">Nome ENS</label>
        <select
          id="checkout-ensName"
          className="checkout-ens"
          value={values.ensName}
          onChange={(e) => onChange("ensName", e.target.value)}
        >
          <option value="">.eth</option>
          {ensNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      {beforeNote}
      <div className="checkout-field checkout-note">
        <label htmlFor="checkout-note">Observação do colecionador</label>
        <textarea
          id="checkout-note"
          value={values.note}
          maxLength={collectorNoteMax}
          aria-invalid={errors.note ? true : undefined}
          aria-describedby={`checkout-note-count${errors.note ? " checkout-note-error" : ""}`}
          onChange={(e) => onChange("note", e.target.value)}
        />
        <p id="checkout-note-count" className="auth-hint">
          {values.note.length} de {collectorNoteMax} caracteres
        </p>
        {errors.note && (
          <p id="checkout-note-error" className="auth-error">
            {errors.note}
          </p>
        )}
      </div>
    </div>
  );
}
type Shared = {
  cart: Cart;
  quote: ReturnType<typeof useCheckoutQuote>;
  wallet: Wallet | null;
  wallets: Wallet[];
  connection: ReturnType<typeof useWalletConnection>;
  selectWallet: (id: string) => void;
  confirming: boolean;
  sendError: string | null;
  onRetrySend: () => void;
  onConfirm: () => void;
  onConfirmNew: () => void;
};
const walletLine = (w: Wallet) => w.ensName ?? shortAddress(w.address);
const networkLine = (w: Wallet) =>
  w.network === "ethereum" && w.role === "primary"
    ? "Rede principal Ethereum"
    : `Rede ${networkNames[w.network]}`;
// Registered wallets as an accessible radio group (native radios: arrow keys
// move between them). The "⋮" menu (editing) comes with the wallets stage.
function WalletRadios({
  wallets,
  wallet,
  selectWallet,
  legend,
}: Pick<Shared, "wallets" | "wallet" | "selectWallet"> & { legend: string }) {
  return (
    <fieldset className="wallet-cards">
      <legend className="sr-only">{legend}</legend>
      {wallets.map((w) => (
        <div className="wallet-card" key={w.id}>
          <input
            type="radio"
            id={`wallet-${w.id}`}
            name="checkout-wallet"
            checked={wallet?.id === w.id}
            onChange={() => selectWallet(w.id)}
          />
          <label htmlFor={`wallet-${w.id}`}>
            <strong>
              {w.label ?? (w.role === "primary" ? "Principal" : "Carteira")}
            </strong>
            <span>{walletLine(w)}</span>
            <span>{networkLine(w)}</span>
          </label>
          <Unavailable
            className="wallet-menu"
            label={`Opções da carteira ${w.label ?? walletLine(w)}`}
            description="A edição de carteiras chega na etapa de carteiras. Por enquanto, cadastre uma nova carteira no pagamento."
          >
            <span aria-hidden="true">⋮</span>
          </Unavailable>
        </div>
      ))}
    </fieldset>
  );
}
function WalletCards(props: Shared) {
  const initiallyOpen = props.wallets.length === 0;
  const [adding, setAdding] = useState(initiallyOpen);
  const [userOpened, setUserOpened] = useState(false);
  return (
    <section className="checkout-wallets" aria-labelledby="wallets-title">
      <div className="checkout-wallets-head">
        <h2 id="wallets-title">Carteira conectada</h2>
        {props.wallets.length > 0 && (
          <button
            className="text-button"
            aria-expanded={adding}
            aria-controls="wallet-form"
            onClick={() => {
              setUserOpened(true);
              setAdding((v) => !v);
            }}
          >
            Trocar carteira
          </button>
        )}
      </div>
      <WalletRadios {...props} legend="Carteiras cadastradas" />
      {adding && (
        <WalletForm
          autoFocus={userOpened || !initiallyOpen}
          onCreated={(w) => {
            props.selectWallet(w.id);
            setAdding(false);
          }}
          onCancel={props.wallets.length ? () => setAdding(false) : undefined}
        />
      )}
      {!adding && props.wallets.length > 0 && (
        <p className="checkout-hint">
          Escolha outra carteira acima ou use “Trocar carteira” para cadastrar
          uma nova.
        </p>
      )}
    </section>
  );
}
// Desktop "Usar outra carteira?": the other registered wallets and the form
// to register a new one.
function OtherWallets(props: Shared) {
  const [open, setOpen] = useState(props.wallets.length === 0);
  const [adding, setAdding] = useState(props.wallets.length === 0);
  return (
    <div className="checkout-other">
      <button
        className="other-toggle"
        aria-expanded={open}
        aria-controls="other-wallets"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="other-radio" aria-hidden="true" data-on={open} />
        Usar outra carteira?
      </button>
      {open && (
        <div id="other-wallets" className="other-wallets">
          {props.wallets.length > 0 && (
            <WalletRadios {...props} legend="Carteira do pagamento" />
          )}
          {adding ? (
            <WalletForm
              autoFocus={props.wallets.length > 0}
              onCreated={(w) => {
                props.selectWallet(w.id);
                setAdding(false);
              }}
              onCancel={
                props.wallets.length ? () => setAdding(false) : undefined
              }
            />
          ) : (
            <button
              className="button button-outline"
              onClick={() => setAdding(true)}
            >
              Cadastrar nova carteira
            </button>
          )}
        </div>
      )}
    </div>
  );
}
// Provider list. It follows the registered wallets: the selected wallet's
// provider is checked; choosing another selects the user's wallet with that
// provider, or offers to register one.
function ProviderGroup(props: Shared & { mobile?: boolean }) {
  const [missing, setMissing] = useState<WalletProvider | null>(null);
  // Same order in both frames: WalletConnect (the badge on desktop),
  // MetaMask, Coinbase Wallet.
  const order: WalletProvider[] = [
    "walletconnect",
    "metamask",
    "coinbase-wallet",
  ];
  function choose(provider: WalletProvider) {
    const match =
      props.wallets.find(
        (w) => w.provider === provider && w.role === "primary",
      ) ?? props.wallets.find((w) => w.provider === provider);
    if (match) {
      setMissing(null);
      props.selectWallet(match.id);
    } else setMissing(provider);
  }
  return (
    <fieldset className="provider-group">
      <legend>Carteira e rede</legend>
      {order.map((provider) => (
        <div className="provider-option" key={provider}>
          <input
            type="radio"
            id={`provider-${provider}`}
            name="checkout-provider"
            checked={
              missing
                ? missing === provider
                : props.wallet?.provider === provider
            }
            onChange={() => choose(provider)}
          />
          <label htmlFor={`provider-${provider}`}>
            {props.mobile && (
              // No wallet icons were exported from the Figma file: every
              // provider uses the frame's letter badge (W, M, C).
              <span className="provider-icon" aria-hidden="true">
                {providerNames[provider][0]}
              </span>
            )}
            {!props.mobile && provider === "walletconnect" ? (
              // Desktop frame: the first option is the compatible-wallets
              // badge; it stands for WalletConnect.
              <>
                <span className="wallet-badge" aria-hidden="true">
                  METAMASK • WALLETCONNECT • COINBASE
                </span>
                <span className="sr-only">WalletConnect</span>
              </>
            ) : (
              providerNames[provider]
            )}
          </label>
        </div>
      ))}
      {missing && (
        <div className="provider-missing">
          <p role="status">
            Você não tem uma carteira {providerNames[missing]} cadastrada.
          </p>
          <WalletForm
            provider={missing}
            onCreated={(w) => {
              setMissing(null);
              props.selectWallet(w.id);
            }}
            onCancel={() => setMissing(null)}
          />
        </div>
      )}
    </fieldset>
  );
}
// `autoFocus` only when the user opened the form; a form shown from the
// start (a user without wallets) does not steal the page's focus.
function WalletForm({
  provider: initialProvider,
  onCreated,
  onCancel,
  autoFocus = true,
}: {
  provider?: WalletProvider;
  onCreated: (wallet: Wallet) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const create = useCreateWallet();
  const [values, setValues] = useState({
    label: "",
    network: "ethereum",
    provider: initialProvider ?? "metamask",
    address: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const firstField = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) firstField.current?.focus();
  }, [autoFocus]);
  const order = ["label", "network", "provider", "address"];
  const focusFirst = (found: Record<string, string>) => {
    const name = order.find((k) => found[k]);
    if (name) document.getElementById(`wallet-form-${name}`)?.focus();
  };
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (create.isPending) return;
    setSummary(null);
    const found = walletErrors(values);
    setErrors(found);
    if (Object.keys(found).length) return focusFirst(found);
    try {
      const wallet = await create.mutateAsync({
        label: values.label.trim(),
        network: values.network as Network,
        provider: values.provider,
        address: values.address.trim(),
      });
      notify(
        `Carteira ${wallet.label ?? ""} cadastrada${wallet.role === "primary" ? " como principal" : ""} e selecionada.`,
      );
      onCreated(wallet);
    } catch (e) {
      const info = apiError(e);
      if (Object.keys(info.fields).length) {
        setErrors(info.fields);
        focusFirst(info.fields);
      } else setSummary(info.message);
    }
  }
  const field = (name: string) => ({
    id: `wallet-form-${name}`,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `wallet-form-${name}-error` : undefined,
  });
  const error = (name: string) =>
    errors[name] && (
      <p id={`wallet-form-${name}-error`} className="auth-error">
        {errors[name]}
      </p>
    );
  return (
    <form
      id="wallet-form"
      className="wallet-form"
      aria-label="Cadastrar nova carteira"
      noValidate
      onSubmit={(e) => void submit(e)}
    >
      <h3>Cadastrar nova carteira</h3>
      <p className="auth-summary" role="alert">
        {summary}
      </p>
      <div className="checkout-field">
        <label htmlFor="wallet-form-label">Nome da carteira</label>
        <input
          ref={firstField}
          {...field("label")}
          value={values.label}
          placeholder="Ex.: Principal, Reserva"
          onChange={(e) => setValues((v) => ({ ...v, label: e.target.value }))}
        />
        {error("label")}
      </div>
      <div className="checkout-field">
        <label htmlFor="wallet-form-network">Rede</label>
        <select
          {...field("network")}
          value={values.network}
          onChange={(e) =>
            setValues((v) => ({ ...v, network: e.target.value }))
          }
        >
          {Object.entries(networkNames).map(([value, name]) => (
            <option key={value} value={value}>
              {name}
            </option>
          ))}
        </select>
        {error("network")}
      </div>
      <div className="checkout-field">
        <label htmlFor="wallet-form-provider">Provedor</label>
        <select
          {...field("provider")}
          value={values.provider}
          onChange={(e) =>
            setValues((v) => ({
              ...v,
              provider: e.target.value as WalletProvider,
            }))
          }
        >
          {walletProviders.map((p) => (
            <option key={p} value={p}>
              {providerNames[p]}
            </option>
          ))}
        </select>
        {error("provider")}
      </div>
      <div className="checkout-field">
        <label htmlFor="wallet-form-address">Endereço da carteira</label>
        <input
          {...field("address")}
          value={values.address}
          spellCheck={false}
          autoComplete="off"
          placeholder={
            values.network === "solana"
              ? "Endereço Solana (base58)"
              : "Endereço 0x da carteira"
          }
          onChange={(e) =>
            setValues((v) => ({ ...v, address: e.target.value }))
          }
        />
        {error("address")}
      </div>
      <div className="wallet-form-actions">
        <button
          type="submit"
          className="button button-primary"
          aria-disabled={create.isPending}
        >
          {create.isPending ? "Cadastrando…" : "Cadastrar carteira"}
        </button>
        {onCancel && (
          <button
            type="button"
            className="button button-outline"
            onClick={onCancel}
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
// Visible connection state, announced by its own polite region once per
// change; it is not repeated in the toast channel, so nothing is read twice.
function ConnectionStatus({
  connection,
  wallet,
}: {
  connection: ReturnType<typeof useWalletConnection>;
  wallet: Wallet | null;
}) {
  const provider = wallet ? providerNames[wallet.provider] : "";
  const text =
    connection.status === "connecting"
      ? `Conectando à ${provider}…`
      : connection.status === "active"
        ? `${provider} conectada · Rede ${wallet ? networkNames[wallet.network] : ""}`
        : connection.status === "rejected"
          ? "Conexão recusada na carteira."
          : connection.status === "disconnected"
            ? "A carteira foi desconectada. Conecte-a novamente para confirmar a compra."
            : connection.status === "error"
              ? (connection.error ?? "Não foi possível conectar a carteira.")
              : "Escolha ou cadastre uma carteira para continuar.";
  const retryable =
    connection.status === "rejected" ||
    connection.status === "disconnected" ||
    connection.status === "error";
  return (
    <div
      id="connection-status"
      className={`connection-status connection-${connection.status}`}
    >
      {/* The status is already visible here, so it is announced by its own
          polite region (once per change) rather than repeated as a toast. */}
      <p role="status">{connection.status === "idle" ? "" : text}</p>
      {connection.status === "idle" && <p>{text}</p>}
      {retryable && (
        <button className="button button-outline" onClick={connection.retry}>
          {connection.status === "disconnected"
            ? "Reconectar"
            : "Tentar novamente"}
        </button>
      )}
    </div>
  );
}
function OrderItems({ cart, quote }: { cart: Cart; quote: Quote | null }) {
  const items = quote?.items ?? cart.items;
  return (
    <>
      <div className="checkout-items-head" aria-hidden="true">
        <span>NFTs</span>
        <span>Subtotal</span>
      </div>
      <ul className="checkout-items" aria-label="Itens do pedido">
        {items.map((line) => (
          <li key={line.id}>
            <img
              {...artImage(line.artwork, "80px")}
              width="80"
              height="80"
              alt=""
            />
            <div>
              <strong>{line.name}</strong>
              <span>
                {line.editionLabel} · ID do token: {line.tokenId}
              </span>
            </div>
            <span className="checkout-qty">(x {line.quantity})</span>
            <span className="checkout-line-total">
              {eth(line.lineTotalEth)}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
// The cart's coupon, applied from the checkout through the same endpoints;
// applying or removing changes the cart version, which gives a new quote.
function CouponField({ cart }: { cart: Cart }) {
  const apply = useCartMutation(applyCoupon);
  const clear = useCartMutation(removeCoupon);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pending = apply.isPending || clear.isPending;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    try {
      const next = await apply.mutateAsync(code);
      setCode("");
      setOpen(false);
      notify(`Cupom ${next.coupon?.code ?? ""} aplicado.`);
    } catch (e) {
      const info = apiError(e);
      setError(info.fields.coupon ?? info.message);
    }
  }
  return (
    <div className="checkout-coupon">
      {cart.coupon ? (
        <p>
          Cupom {cart.coupon.code}: {cart.coupon.description}.{" "}
          <button
            className="text-button"
            aria-disabled={pending}
            onClick={() =>
              void clear
                .mutateAsync(undefined)
                .then(() => notify("Cupom removido."))
                .catch((e: unknown) => setError(apiError(e).message))
            }
          >
            Remover cupom
          </button>
        </p>
      ) : (
        <>
          {/* An expired coupon (reason shown in the summary) can be removed,
              which clears the stored code and the message. */}
          {cart.couponRemoved && (
            <button
              className="text-button"
              aria-disabled={pending}
              aria-label={`Remover cupom ${cart.couponRemoved.code}`}
              onClick={() =>
                void clear
                  .mutateAsync(undefined)
                  .then(() => notify("Cupom removido."))
                  .catch((e: unknown) => setError(apiError(e).message))
              }
            >
              Remover cupom expirado
            </button>
          )}
          <button
            className="text-button"
            aria-expanded={open}
            aria-controls="checkout-coupon-form"
            onClick={() => setOpen((v) => !v)}
          >
            Tem um código promocional? Aplique aqui
          </button>
        </>
      )}
      {open && !cart.coupon && (
        <form
          id="checkout-coupon-form"
          className="coupon"
          noValidate
          onSubmit={(e) => void submit(e)}
        >
          <label htmlFor="checkout-coupon">Código promocional</label>
          <div>
            <input
              id="checkout-coupon"
              value={code}
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="Digite o código promocional..."
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "checkout-coupon-error" : undefined}
              onChange={(e) => setCode(e.target.value)}
            />
            <button type="submit" aria-disabled={pending}>
              {apply.isPending ? "Aplicando…" : "Aplicar"}
            </button>
          </div>
        </form>
      )}
      {error && (
        <p id="checkout-coupon-error" className="cart-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
function Amounts({ quote }: { quote: Quote | null }) {
  const a = quote?.amounts;
  const dash = "—";
  const discounted = a && compareEth(a.discountEth, "0") > 0;
  // Only name/value groups inside the <dl>; notes live after it.
  return (
    <>
      <dl className="amounts checkout-amounts" aria-busy={!quote}>
        <div>
          <dt>Subtotal</dt>
          <dd>{a ? eth(a.subtotalEth) : dash}</dd>
        </div>
        <div>
          <dt>
            {quote?.coupon ? `Desconto (${quote.coupon.code})` : "Desconto"}
          </dt>
          <dd>
            {a ? (discounted ? `(-) ${eth(a.discountEth)}` : eth("0")) : dash}
          </dd>
        </div>
        <div>
          {/* With a wallet chosen the fee is that of its network, not estimated. */}
          <dt>
            {quote
              ? `Taxa de rede (${networkNames[quote.network]})`
              : "Taxa de rede"}
          </dt>
          <dd>{a ? eth(a.networkFeeEth) : dash}</dd>
        </div>
        <div className="amount-total">
          <dt>Total</dt>
          <dd>{a ? eth(a.totalEth) : dash}</dd>
        </div>
      </dl>
      {!quote && (
        <p className="checkout-hint">
          Os valores são calculados pela API depois que a carteira conecta.
        </p>
      )}
      {/* Shown for any displayed quote, the first one included, without
          depending on a comparison between quotes. */}
      <p className="coupon-removed quote-coupon-removed" role="status">
        {quote?.couponRemoved?.reason ?? ""}
      </p>
    </>
  );
}
// Revalidation outcomes: changed values (never applied in silence), items no
// longer available, and quote failures.
function QuoteNotices({ quote, onConfirmNew }: Shared) {
  const { pending, error } = quote;
  if (pending)
    return (
      <section className="quote-changes" aria-labelledby="quote-changes-title">
        <h3 id="quote-changes-title">Os valores do pedido mudaram</h3>
        <ul>
          {pending.changes.map((change) => (
            <li key={change}>{change}</li>
          ))}
        </ul>
        <p>
          Novo total: <strong>{eth(pending.quote.amounts.totalEth)}</strong>
        </p>
        <button className="button button-primary" onClick={onConfirmNew}>
          Revisei, confirmar com os novos valores
        </button>
      </section>
    );
  if (error?.code === "UNAVAILABLE_ITEMS")
    return (
      <section className="quote-changes" role="alert">
        <h3>Alguns itens não estão mais disponíveis</h3>
        <ul>
          {Object.values(error.fields).map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
        <Link className="button button-outline" to="/cart">
          Ajustar no carrinho
        </Link>
      </section>
    );
  if (
    error &&
    error.code !== "WALLET_DISCONNECTED" &&
    error.code !== "CART_CHANGED"
  )
    return (
      <div className="cart-refresh-error" role="alert">
        <p>Não foi possível calcular os valores do pedido. {error.message}</p>
        <button
          className="button button-outline"
          onClick={() => void quote.revalidate()}
        >
          Tentar novamente
        </button>
      </div>
    );
  return null;
}
function ConfirmButton({
  quote,
  connection,
  confirming,
  sendError,
  onRetrySend,
  onConfirm,
}: Shared) {
  const ready =
    !!quote.quote && connection.status === "active" && !quote.pending;
  return (
    <>
      {sendError && (
        <div className="cart-refresh-error" role="alert">
          <p>{sendError}</p>
          {sendError === "Não foi possível confirmar o envio do pedido." && (
            <button
              className="button button-outline"
              aria-disabled={confirming}
              onClick={() => !confirming && onRetrySend()}
            >
              Tentar novamente
            </button>
          )}
        </div>
      )}
      <button
        className="button button-primary checkout-confirm"
        aria-disabled={!ready || confirming}
        aria-describedby={ready ? undefined : "connection-status"}
        onClick={() => ready && !confirming && onConfirm()}
      >
        {confirming ? "Enviando…" : "Confirmar compra"}
      </button>
    </>
  );
}
