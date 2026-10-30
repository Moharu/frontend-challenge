import { discoverySearch } from "@/lib/discovery-search";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Link,
  useCanGoBack,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { Cart, CartLine } from "@/contracts/cart";
import { compareEth, formatEth } from "@/contracts/eth";
import {
  applyCoupon,
  changeCartItem,
  removeCartItem,
  removeCoupon,
} from "@/data/cart/api";
import { useCart, useCartMutation } from "@/data/cart/hooks";
import { useIdentity } from "@/data/session/identity";
import { nftListOptions } from "@/data/nfts/queries";
import { apiError } from "@/lib/api-error";
import { authLink } from "@/lib/redirect";
import { Button } from "@/components/ui/button";
import { NftCard } from "@/components/discovery/shared";
import { artImage, asset } from "@/components/discovery/assets";
const eth = (value: string) => `${formatEth(value)} ETH`;
const lineName = (line: CartLine) => `${line.name} (${line.editionLabel})`;
// Focus target applied after the next render: an element id, or the empty state.
type FocusTarget = { id: string; fallback?: string } | null;
export function CartPage() {
  const cart = useCart();
  const focus = useRef<FocusTarget>(null);
  useEffect(() => {
    document.title = "Carrinho | KURIO";
    return () => {
      document.title = "KURIO | Marketplace de NFTs";
    };
  }, []);
  useEffect(() => {
    const target = focus.current;
    if (!target) return;
    focus.current = null;
    const el = document.getElementById(target.id) as HTMLElement | null;
    if (el && !(el instanceof HTMLButtonElement && el.disabled)) el.focus();
    else if (target.fallback) document.getElementById(target.fallback)?.focus();
  }, [cart.data]);
  const items = cart.data?.items ?? [];
  return (
    <main id="main" className="cart-page">
      <CartHeader />
      {cart.isPending ? (
        <CartSkeleton />
      ) : cart.isError && cart.data === undefined ? (
        <section className="query-error" role="alert">
          <h2>Não foi possível carregar o carrinho</h2>
          <p>Ocorreu uma falha de conexão. Tente novamente.</p>
          <Button onClick={() => void cart.refetch()}>Tentar novamente</Button>
          <Link to="/" search={discoverySearch({})}>
            Voltar ao catálogo
          </Link>
        </section>
      ) : !cart.data || items.length === 0 ? (
        <section className="empty cart-empty" aria-labelledby="cart-empty">
          <h2 id="cart-empty" tabIndex={-1}>
            Seu carrinho está vazio
          </h2>
          <p>Adicione uma edição pela página de um NFT para vê-la aqui.</p>
          <Link
            className="button button-primary"
            to="/"
            search={discoverySearch({})}
            hash="catalogo"
          >
            Explorar NFTs
          </Link>
        </section>
      ) : (
        <div className="cart-layout">
          {cart.isError && (
            <p className="cart-refresh-error" role="alert">
              Não foi possível atualizar o carrinho. Os valores exibidos podem
              estar desatualizados.{" "}
              <Button variant="ghost" onClick={() => void cart.refetch()}>
                Tentar novamente
              </Button>
            </p>
          )}
          <CartTable
            cart={cart.data}
            onRemoved={(index) => {
              const next = items[index + 1] ?? items[index - 1];
              focus.current = {
                id: next ? `cart-line-${next.id}` : "cart-empty",
              };
            }}
            onChanged={(buttonId, lineId) => {
              focus.current = { id: buttonId, fallback: `qty-${lineId}` };
            }}
          />
          <CartSummary cart={cart.data} />
          <Announcer cart={cart.data} />
        </div>
      )}
      <Recommendations exclude={items.map((i) => i.nftId)} />
    </main>
  );
}
function CartHeader() {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const navigate = useNavigate();
  return (
    <>
      <nav className="breadcrumbs cart-breadcrumbs" aria-label="Trilha">
        <Link to="/" search={discoverySearch({})}>
          Início
        </Link>{" "}
        /{" "}
        <Link to="/" search={discoverySearch({})} hash="catalogo">
          Mercado
        </Link>{" "}
        / <span aria-current="page">Carrinho</span>
      </nav>
      <div className="cart-mobile-header">
        <button
          className="cart-back"
          aria-label="Voltar"
          onClick={() =>
            canGoBack
              ? router.history.back()
              : void navigate({ to: "/", search: discoverySearch({}) })
          }
        >
          <img src={asset("mobile-detail-ArrowLeft2.svg")} alt="" />
        </button>
        <h1>Carrinho de NFTs</h1>
      </div>
    </>
  );
}
// The fixed mobile summary reserves its measured height at the end of the page
// (after the footer) so the last card and the footer are never hidden behind it.
function useReservedSpace() {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const update = () =>
      root.style.setProperty(
        "--summary-space",
        getComputedStyle(el).position === "fixed"
          ? `${el.offsetHeight}px`
          : "0px",
      );
    const observer = new ResizeObserver(update);
    observer.observe(el);
    update();
    return () => {
      observer.disconnect();
      root.style.removeProperty("--summary-space");
    };
  }, []);
  return ref;
}
function CartTable({
  cart,
  onRemoved,
  onChanged,
}: {
  cart: Cart;
  onRemoved: (index: number) => void;
  onChanged: (buttonId: string, lineId: string) => void;
}) {
  return (
    <table className="cart-table">
      <caption className="sr-only">Itens do carrinho</caption>
      <thead>
        <tr>
          <th scope="col">NFTs</th>
          <th scope="col">Preço</th>
          <th scope="col">Edições</th>
          <th scope="col">Total</th>
          <th scope="col">
            <span className="sr-only">Remover</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {cart.items.map((line, index) => (
          <CartRow
            key={line.id}
            line={line}
            onRemoved={() => onRemoved(index)}
            onChanged={onChanged}
          />
        ))}
      </tbody>
    </table>
  );
}
function CartRow({
  line,
  onRemoved,
  onChanged,
}: {
  line: CartLine;
  onRemoved: () => void;
  onChanged: (buttonId: string, lineId: string) => void;
}) {
  const change = useCartMutation(
    (body: { quantity?: number; acknowledgePriceEth?: string }) =>
      changeCartItem(line.id, body),
  );
  const remove = useCartMutation(() => removeCartItem(line.id));
  const [error, setError] = useState<string | null>(null);
  const pending = change.isPending || remove.isPending;
  const noticeId = `notice-${line.id}`;
  const errorId = `error-${line.id}`;
  async function run(
    action: () => Promise<unknown>,
    after?: () => void,
  ): Promise<void> {
    if (pending) return;
    setError(null);
    try {
      await action();
      after?.();
    } catch (e) {
      setError(apiError(e).message);
    }
  }
  const setQuantity = (quantity: number, buttonId: string) =>
    void run(
      () => change.mutateAsync({ quantity }),
      () => onChanged(buttonId, line.id),
    );
  const canDecrease = line.quantity > 1;
  const canIncrease = line.quantity < line.maxQuantity;
  const described = [
    line.conflict || line.priceChange ? noticeId : "",
    error ? errorId : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <tr
      className={line.conflict ? "has-conflict" : undefined}
      aria-busy={pending || undefined}
    >
      <td className="cart-item">
        <img
          {...artImage(line.artwork, "(max-width: 700px) 100px, 80px")}
          width="80"
          height="80"
          alt=""
        />
        <div>
          <Link
            id={`cart-line-${line.id}`}
            to="/nfts/$nftId"
            params={{ nftId: line.nftId }}
          >
            {line.name}
          </Link>
          <p className="cart-token">ID do token: #{line.tokenId}</p>
          <p className="cart-edition">Edição: {line.editionLabel}</p>
          {(line.conflict || line.priceChange) && (
            <div id={noticeId} className="cart-notice">
              {line.conflict?.code === "SOLD_OUT" && (
                <p>Esta edição esgotou. Remova o item para continuar.</p>
              )}
              {line.conflict?.code === "QUANTITY_ABOVE_LIMIT" && (
                <p>
                  Disponível no máximo {line.conflict.maxQuantity}.{" "}
                  <Button
                    variant="outline"
                    onClick={() =>
                      setQuantity(line.conflict!.maxQuantity, `qty-${line.id}`)
                    }
                  >
                    Ajustar para {line.conflict.maxQuantity}
                  </Button>
                </p>
              )}
              {line.priceChange && (
                <p>
                  Preço alterado de {eth(line.priceChange.previousEth)} para{" "}
                  {eth(line.priceChange.currentEth)}.{" "}
                  <Button
                    variant="ghost"
                    onClick={() =>
                      void run(() =>
                        change.mutateAsync({
                          acknowledgePriceEth: line.priceChange!.currentEth,
                        }),
                      )
                    }
                  >
                    Ciente do novo preço
                  </Button>
                </p>
              )}
            </div>
          )}
          {error && (
            <p id={errorId} className="cart-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </td>
      <td className="cart-unit">{eth(line.unitPriceEth)}</td>
      <td className="cart-quantity">
        <div>
          <button
            id={`dec-${line.id}`}
            className="qty-button"
            aria-label={`Diminuir quantidade de ${lineName(line)}, atual ${line.quantity}`}
            aria-disabled={!canDecrease || pending}
            aria-describedby={described || undefined}
            onClick={() =>
              canDecrease && setQuantity(line.quantity - 1, `dec-${line.id}`)
            }
          >
            <img src={asset("cart-Minus.svg")} alt="" />
            <span aria-hidden="true">−</span>
          </button>
          <span id={`qty-${line.id}`} tabIndex={-1} className="qty-value">
            {line.quantity}
          </span>
          <button
            id={`inc-${line.id}`}
            className="qty-button"
            aria-label={`Aumentar quantidade de ${lineName(line)}, atual ${line.quantity}`}
            aria-disabled={!canIncrease || pending}
            aria-describedby={described || undefined}
            onClick={() =>
              canIncrease && setQuantity(line.quantity + 1, `inc-${line.id}`)
            }
          >
            <img src={asset("cart-Plus.svg")} alt="" />
            <span aria-hidden="true">+</span>
          </button>
        </div>
        {pending && <span className="sr-only">Atualizando…</span>}
      </td>
      <td className="cart-line-total price">{eth(line.lineTotalEth)}</td>
      <td className="cart-remove">
        <button
          aria-label={`Remover ${lineName(line)} do carrinho`}
          aria-disabled={pending}
          onClick={() => void run(() => remove.mutateAsync(), onRemoved)}
        >
          <img src={asset("cart-Trash.svg")} alt="" />
        </button>
      </td>
    </tr>
  );
}
function CartSummary({ cart }: { cart: Cart }) {
  const apply = useCartMutation(applyCoupon);
  const clear = useCartMutation(removeCoupon);
  const [code, setCode] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponStatus, setCouponStatus] = useState("");
  const pending = apply.isPending || clear.isPending;
  const { summary } = cart;
  const reserve = useReservedSpace();
  const signedIn = useIdentity().status === "authenticated";
  const discounted = compareEth(summary.discountEth, "0") > 0;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setCouponError(null);
    setCouponStatus("");
    try {
      const next = await apply.mutateAsync(code);
      setCode("");
      setCouponStatus(`Cupom ${next.coupon?.code ?? ""} aplicado.`);
    } catch (e) {
      const info = apiError(e);
      setCouponError(info.fields.coupon ?? info.message);
    }
  }
  async function removeApplied() {
    if (pending) return;
    setCouponError(null);
    try {
      await clear.mutateAsync(undefined);
      setCouponStatus("Cupom removido.");
    } catch (e) {
      setCouponError(apiError(e).message);
    }
  }
  return (
    <aside
      ref={reserve}
      className="cart-summary"
      aria-labelledby="summary-title"
    >
      <h2 id="summary-title">Resumo da carteira</h2>
      <form className="coupon" onSubmit={(e) => void submit(e)} noValidate>
        <label htmlFor="coupon">Código promocional</label>
        <div>
          <input
            id="coupon"
            value={code}
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="Digite o código promocional..."
            aria-invalid={couponError ? true : undefined}
            aria-describedby={
              [
                couponError ? "coupon-error" : "",
                cart.coupon ? "coupon-applied" : "",
              ]
                .filter(Boolean)
                .join(" ") || undefined
            }
            onChange={(e) => setCode(e.target.value)}
          />
          <button type="submit" aria-disabled={pending}>
            {apply.isPending ? "Aplicando…" : "Aplicar"}
          </button>
        </div>
        {couponError && (
          <p id="coupon-error" className="cart-error" role="alert">
            {couponError}
          </p>
        )}
        {cart.coupon && (
          <p id="coupon-applied" className="coupon-applied">
            Cupom {cart.coupon.code}: {cart.coupon.description}.{" "}
            <button
              type="button"
              aria-disabled={pending}
              onClick={() => void removeApplied()}
            >
              Remover cupom
            </button>
          </p>
        )}
        {/* An applied coupon that expired: no discount, and the reason. */}
        <p className="coupon-removed" role="status">
          {cart.couponRemoved?.reason ?? ""}
        </p>
        {/* Removing it clears the stored code and the message. */}
        {cart.couponRemoved && (
          <button
            type="button"
            className="coupon-clear"
            aria-disabled={pending}
            aria-label={`Remover cupom ${cart.couponRemoved.code}`}
            onClick={() => void removeApplied()}
          >
            Remover cupom
          </button>
        )}
        <p className="sr-only" role="status">
          {couponStatus}
        </p>
      </form>
      <dl className="amounts">
        <div>
          <dt>Subtotal</dt>
          <dd>{eth(summary.subtotalEth)}</dd>
        </div>
        <div>
          <dt>{cart.coupon ? `Desconto (${cart.coupon.code})` : "Desconto"}</dt>
          <dd>{discounted ? `(-) ${eth(summary.discountEth)}` : eth("0")}</dd>
        </div>
        <div>
          <dt>Taxa de rede</dt>
          <dd>
            {eth(summary.networkFeeEth)}
            {summary.feeEstimated && <small>Taxa estimada (Ethereum)</small>}
          </dd>
        </div>
        <div className="amount-total">
          <dt>Total</dt>
          <dd>{eth(summary.totalEth)}</dd>
        </div>
      </dl>
      {cart.hasConflicts ? (
        <>
          <Button
            className="checkout-button"
            disabled
            aria-describedby="checkout-blocked"
          >
            Conectar e finalizar
          </Button>
          <p id="checkout-blocked" className="cart-error">
            Resolva os itens indisponíveis ou acima do limite para continuar.
          </p>
        </>
      ) : signedIn ? (
        <Link
          className="button button-primary checkout-button"
          to="/checkout"
          search={{ step: "dados" }}
        >
          Conectar e finalizar
        </Link>
      ) : (
        // Checkout requires a session: sign in over the cart, then continue
        // to the checkout.
        <Link
          className="button button-primary checkout-button"
          {...authLink("login", "/checkout", "/cart")}
        >
          Conectar e finalizar
        </Link>
      )}
      <Link
        className="continue-link"
        to="/"
        search={discoverySearch({})}
        hash="catalogo"
      >
        Continuar explorando
      </Link>
    </aside>
  );
}
// Announces price/availability changes and the new total without repeating
// the page; the first load is not announced.
function Announcer({ cart }: { cart: Cart }) {
  const previous = useRef<Cart | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const before = previous.current;
    previous.current = cart;
    if (!before) return;
    const message = [
      describeChanges(before, cart),
      compareEth(before.summary.totalEth, cart.summary.totalEth) !== 0
        ? `Total atualizado: ${eth(cart.summary.totalEth)}.`
        : "",
    ]
      .filter(Boolean)
      .join(" ");
    if (message) setMessage(message);
  }, [cart]);
  return (
    <p id="cart-announcer" className="sr-only" role="status">
      {message}
    </p>
  );
}
function describeChanges(before: Cart, after: Cart) {
  return after.items
    .map((line) => {
      const old = before.items.find((i) => i.id === line.id);
      if (!old) return "";
      if (
        line.conflict?.code === "SOLD_OUT" &&
        old.conflict?.code !== "SOLD_OUT"
      )
        return `${lineName(line)} esgotou.`;
      if (
        line.conflict?.code === "QUANTITY_ABOVE_LIMIT" &&
        old.conflict?.maxQuantity !== line.conflict.maxQuantity
      )
        return `${lineName(line)}: disponível no máximo ${line.conflict.maxQuantity}.`;
      if (compareEth(old.unitPriceEth, line.unitPriceEth) !== 0)
        return `Preço de ${lineName(line)} mudou para ${eth(line.unitPriceEth)}.`;
      return "";
    })
    .filter(Boolean)
    .join(" ");
}
function CartSkeleton() {
  return (
    <div className="cart-layout" role="status" aria-label="Carregando carrinho">
      <div className="cart-skeleton-lines">
        {Array.from({ length: 3 }, (_, i) => (
          <div className="skeleton cart-skeleton-line" key={i} />
        ))}
      </div>
      <div className="skeleton cart-skeleton-summary" />
    </div>
  );
}
// "Colecionadores também viram": trending NFTs not already in the cart, reusing
// GET /nfts; the section is hidden when nothing remains.
function Recommendations({ exclude }: { exclude: string[] }) {
  const trending = useQuery(nftListOptions({ mode: "trending", pageSize: 15 }));
  const scroller = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const items = (trending.data?.data ?? []).filter(
    (n) => !exclude.includes(n.id),
  );
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () => {
      const total = Math.max(
        1,
        Math.ceil(el.scrollWidth / el.clientWidth - 0.01),
      );
      setPages(total);
      setPage(Math.min(total - 1, Math.round(el.scrollLeft / el.clientWidth)));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [items.length]);
  if (!trending.data || items.length === 0) return null;
  return (
    <section className="related recommendations" aria-labelledby="recommended">
      <h2 id="recommended">Colecionadores também viram</h2>
      <div className="carousel" ref={scroller}>
        {items.map((n) => (
          <NftCard key={n.id} nft={n} />
        ))}
      </div>
      {pages > 1 && (
        <div className="carousel-dots">
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              aria-label={`Recomendações, página ${i + 1} de ${pages}`}
              aria-current={i === page ? "true" : undefined}
              onClick={() =>
                scroller.current?.scrollTo({
                  left: i * scroller.current.clientWidth,
                  behavior: matchMedia("(prefers-reduced-motion: reduce)")
                    .matches
                    ? "auto"
                    : "smooth",
                })
              }
            >
              <img
                src={asset(
                  i === page ? "cart-DotFilled.svg" : "cart-DotEmpty.svg",
                )}
                alt=""
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
