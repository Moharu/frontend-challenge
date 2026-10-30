import { useEffect, useRef, useSyncExternalStore } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { compareEth, formatEth } from "@/contracts/eth";
import { isOrderUpdated } from "@/contracts/events";
import {
  isTerminal,
  type Order,
  type OrderReceipt,
  type PurchasedItem,
} from "@/contracts/orders";
import { networkNames, providerNames, shortAddress } from "@/contracts/wallets";
import { getOrder, getReceipt } from "@/data/orders/api";
import { discardPendingOrder } from "@/data/orders/pending";
import {
  cartScope,
  useIdentity,
  type CartScope,
} from "@/data/session/identity";
import { apiError } from "@/lib/api-error";
import { discoverySearch } from "@/lib/discovery-search";
import { getRealtime, subscribeRealtime } from "@/realtime/instance";
import { Unavailable } from "@/components/discovery/shared";
import { artImage } from "@/components/discovery/assets";
const eth = (value: string) => `${formatEth(value)} ETH`;
const orderKey = (scope: CartScope, id: string) =>
  ["order", scope, id] as const;
const receiptKey = (scope: CartScope, id: string) =>
  ["receipt", scope, id] as const;
// A newer order replaces the cached one; a terminal state never regresses,
// and an older or equal version never wins (duplicate or stale events).
function newerOrder(current: Order | undefined, next: Order) {
  if (!current) return next;
  if (isTerminal(current.status)) return current;
  return next.version > current.version ? next : current;
}
const date = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
export function OrderPage() {
  const { orderId } = useParams({ from: "/orders/$orderId" });
  const identity = useIdentity();
  const scope = cartScope(identity);
  const queryClient = useQueryClient();
  const realtime = useSyncExternalStore(subscribeRealtime, getRealtime);
  useEffect(() => {
    document.title = "Pedido | KURIO";
    return () => {
      document.title = "KURIO | Marketplace de NFTs";
    };
  }, []);
  const order = useQuery({
    queryKey: orderKey(scope, orderId),
    queryFn: ({ signal }) => getOrder(orderId, signal),
    enabled: scope?.kind === "user",
    retry: false,
    refetchOnWindowFocus: true,
    structuralSharing: (current, next) =>
      newerOrder(current as Order | undefined, next as Order),
  });
  const status = order.data?.status;
  const receipt = useQuery({
    queryKey: receiptKey(scope, orderId),
    queryFn: ({ signal }) => getReceipt(orderId, signal),
    enabled: scope?.kind === "user" && status === "confirmed",
    retry: false,
    // Immutable once issued.
    staleTime: Infinity,
  });
  // Private events of this order (delivered only to the owner's session).
  const generation = identity.session?.generation;
  useEffect(() => {
    if (!realtime || !generation) return;
    try {
      realtime.onPrivate("order.updated", (value) => {
        if (!isOrderUpdated(value) || value.resourceId !== orderId) return;
        queryClient.setQueryData<Order>(orderKey(scope, orderId), (current) =>
          newerOrder(current, value.payload),
        );
      });
    } catch {
      // No session on the socket yet: REST reconciliation covers it.
    }
  }, [realtime, generation, orderId, queryClient]); // eslint-disable-line react-hooks/exhaustive-deps
  // A terminal state seen by the user: the idempotency key is done, and on
  // confirmation the cart (reduced by the API) is fetched again.
  const userId = identity.session?.user.id;
  useEffect(() => {
    if (!userId || !status || !isTerminal(status)) return;
    discardPendingOrder(userId, orderId);
    if (status === "confirmed")
      void queryClient.invalidateQueries({ queryKey: ["cart"] });
  }, [userId, status, orderId, queryClient]);
  // The change from pending to a final state is announced once and focus
  // moves to the new title.
  // The live region is written directly (once per transition).
  const heading = useRef<HTMLHeadingElement>(null);
  const live = useRef<HTMLParagraphElement>(null);
  const previous = useRef(status);
  useEffect(() => {
    const was = previous.current;
    previous.current = status;
    if (was === "pending" && status && status !== "pending") {
      if (live.current)
        live.current.textContent =
          status === "confirmed"
            ? "Pagamento confirmado. Seus NFTs estão na sua carteira."
            : "Pagamento recusado. Seu carrinho foi preservado.";
      heading.current?.focus();
    }
  }, [status]);
  if (order.isPending)
    return (
      <main
        id="main"
        className="order-page grid place-items-center max-[701px]:block max-[701px]:min-h-[100dvh]"
        aria-busy="true"
      >
        <p
          className="checkout-waiting py-[48px] px-[0] text-[color:var(--muted-foreground)]"
          role="status"
        >
          Carregando o pedido…
        </p>
      </main>
    );
  if (order.isError && !order.data) {
    const info = apiError(order.error);
    return (
      <main
        id="main"
        className="order-page grid place-items-center max-[701px]:block max-[701px]:min-h-[100dvh]"
      >
        <section className="query-error" role="alert">
          <h1>
            {info.status === 403
              ? "Este pedido pertence a outra conta"
              : info.status === 404
                ? "Pedido não encontrado"
                : "Não foi possível carregar o pedido"}
          </h1>
          <p>
            {info.status === 403
              ? "Entre com a conta que fez a compra para ver este pedido."
              : info.status === 404
                ? "Confira o endereço do pedido."
                : "Ocorreu uma falha de conexão. Tente novamente."}
          </p>
          {info.status !== 403 && info.status !== 404 && (
            <button
              className="button button-primary"
              onClick={() => void order.refetch()}
            >
              Tentar novamente
            </button>
          )}
          <Link to="/" search={discoverySearch({})}>
            Voltar ao catálogo
          </Link>
        </section>
      </main>
    );
  }
  const data = order.data!;
  return (
    <main
      id="main"
      className="order-page grid place-items-center max-[701px]:block max-[701px]:min-h-[100dvh]"
    >
      <p ref={live} className="sr-only" role="status" />
      <article
        className={`order-card order-${data.status}`}
        aria-labelledby="order-title"
      >
        <Link
          className="order-close absolute grid place-items-center w-[36px] h-[36px] rounded-[50%] leading-[1] text-[color:var(--foreground)] min-[701px]:rounded-[0] min-[701px]:text-[color:var(--accent)]"
          to="/"
          search={discoverySearch({})}
          aria-label="Fechar e voltar ao catálogo"
        >
          ×
        </Link>
        {data.status === "confirmed" ? (
          <Confirmed
            receipt={receipt.data}
            receiptError={receipt.isError}
            retryReceipt={() => void receipt.refetch()}
            heading={heading}
          />
        ) : data.status === "declined" ? (
          <Declined order={data} heading={heading} />
        ) : (
          <Pending order={data} heading={heading} />
        )}
      </article>
    </main>
  );
}
type Heading = { heading: React.RefObject<HTMLHeadingElement | null> };
function Pending({ order, heading }: { order: Order } & Heading) {
  return (
    <>
      <div
        className="order-progress h-[4px] mt-[0] mr-[auto] mb-[24px] ml-[auto] max-w-[320px] rounded-[4px] motion-reduce:opacity-[0.6]"
        aria-hidden="true"
      />
      <h1 id="order-title" ref={heading} tabIndex={-1}>
        Aguardando confirmação da rede
      </h1>
      <p className="order-lead max-w-[560px] mt-[0] mr-[auto] mb-[16px] ml-[auto] text-[color:var(--muted-foreground)] leading-[1.6]">
        Seu pagamento foi enviado pela carteira{" "}
        {providerNames[order.wallet.provider]} na rede{" "}
        {networkNames[order.wallet.network]}. Você pode sair desta página e
        voltar a este endereço a qualquer momento: o pedido continua sendo
        processado.
      </p>
      <Items items={order.items} />
      <Totals amounts={order.amounts} />
    </>
  );
}
function Declined({ order, heading }: { order: Order } & Heading) {
  return (
    <>
      <h1 id="order-title" ref={heading} tabIndex={-1}>
        Pagamento recusado
      </h1>
      <p className="order-lead max-w-[560px] mt-[0] mr-[auto] mb-[16px] ml-[auto] text-[color:var(--muted-foreground)] leading-[1.6]">
        Motivo: <strong>{order.declineCode}</strong>
      </p>
      <p className="order-lead max-w-[560px] mt-[0] mr-[auto] mb-[16px] ml-[auto] text-[color:var(--muted-foreground)] leading-[1.6]">
        Nenhum valor foi cobrado e seu carrinho foi preservado, com os mesmos
        itens. Revise a carteira e tente novamente.
      </p>
      <Link
        className="button button-primary order-action"
        to="/checkout"
        search={{ step: "dados" }}
      >
        Voltar ao checkout
      </Link>
    </>
  );
}
function Confirmed({
  receipt,
  receiptError,
  retryReceipt,
  heading,
}: {
  receipt: OrderReceipt | undefined;
  receiptError: boolean;
  retryReceipt: () => void;
} & Heading) {
  // The title keeps its place in both variants, so focus stays on it when
  // the receipt arrives.
  if (!receipt)
    return (
      <>
        <Thanks />
        <h1 id="order-title" ref={heading} tabIndex={-1}>
          Seus NFTs agora estão na sua carteira
        </h1>
        {receiptError ? (
          <div
            className="cart-refresh-error col-span-full m-[0] text-[#ffb08a]"
            role="alert"
          >
            <p>Não foi possível carregar o recibo.</p>
            <button className="button button-outline" onClick={retryReceipt}>
              Tentar novamente
            </button>
          </div>
        ) : (
          <p
            className="checkout-waiting py-[48px] px-[0] text-[color:var(--muted-foreground)]"
            role="status"
          >
            Carregando o recibo…
          </p>
        )}
      </>
    );
  const network = networkNames[receipt.wallet.network];
  return (
    <>
      <Thanks />
      <h1 id="order-title" ref={heading} tabIndex={-1}>
        Seus NFTs agora estão na sua carteira
      </h1>
      <dl className="order-facts grid max-[701px]:gap-[12px]">
        <div>
          <dt>ID da transação</dt>
          <dd>
            <span aria-hidden="true">
              {shortAddress(receipt.transactionReference)}
            </span>
            <span className="sr-only">{receipt.transactionReference}</span>
          </dd>
        </div>
        <div>
          <dt>Data</dt>
          <dd>
            <time dateTime={receipt.confirmedAt}>
              {date(receipt.confirmedAt)}
            </time>
          </dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>{eth(receipt.amounts.totalEth)}</dd>
        </div>
        <div>
          <dt>Carteira</dt>
          <dd>
            <span aria-hidden="true">
              {providerNames[receipt.wallet.provider]}
            </span>
            <span className="sr-only">
              {providerNames[receipt.wallet.provider]}, {receipt.wallet.address}
            </span>
          </dd>
        </div>
      </dl>
      <h2 className="order-subtitle mt-[0] mr-[0] mb-[12px] ml-[0] text-[18px] text-left min-[701px]:mb-[6px]">
        Detalhes da transação
      </h2>
      <Items items={receipt.items} />
      <Totals amounts={receipt.amounts} />
      <p className="order-note mt-[0] mr-[auto] mb-[24px] ml-[auto] max-w-[600px] text-[color:var(--muted-foreground)] leading-[1.6]">
        Transação confirmada na {network}. A propriedade foi transferida para
        sua carteira conectada e registrada na rede.
      </p>
      <Unavailable
        className="button button-primary order-action"
        label="Ver no Etherscan"
        description="Esta demonstração não usa uma blockchain real: não há transação para abrir no Etherscan. O recibo acima é a referência simulada da compra."
      >
        Ver no Etherscan
      </Unavailable>
    </>
  );
}
// The frame's "THANK YOU" envelope; the asset was not exported, so it is
// redrawn as a decorative SVG in the accent color.
function Thanks() {
  return (
    <svg
      className="order-thanks block mt-[0] mr-[auto] mb-[16px] ml-[auto] text-[color:var(--accent)] max-[701px]:w-[64px] max-[701px]:h-[80px]"
      viewBox="0 0 80 100"
      width="80"
      height="100"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <path d="M34 9a6 6 0 0 1 12 0" />
      <rect x="15" y="9" width="50" height="44" rx="3" />
      <text
        x="40"
        y="27"
        fill="currentColor"
        stroke="none"
        fontSize="11"
        fontWeight="800"
        textAnchor="middle"
      >
        THANK
      </text>
      <text
        x="40"
        y="41"
        fill="currentColor"
        stroke="none"
        fontSize="11"
        fontWeight="800"
        textAnchor="middle"
      >
        YOU
      </text>
      <path d="M8 40 40 68 72 40V95H8Z" fill="var(--surface)" />
      <path d="M8 95 33 72M72 95 47 72M8 40l7-6M72 40l-7-6" />
    </svg>
  );
}
function Items({ items }: { items: ReadonlyArray<PurchasedItem> }) {
  return (
    <table className="order-items w-[100%] text-left">
      <caption className="sr-only">Itens do pedido</caption>
      <thead>
        <tr>
          <th scope="col">NFTs</th>
          <th scope="col">Edições</th>
          <th scope="col">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={`${item.nftId}:${item.editionId}`}>
            <th scope="row">
              <img
                {...artImage(item.artwork, "64px")}
                width="64"
                height="64"
                alt=""
              />
              <span>
                <strong>{item.name}</strong>
                <span>
                  {item.editionLabel} · ID do token: #{item.tokenId}
                </span>
              </span>
            </th>
            <td>(x {item.quantity})</td>
            <td>{eth(item.lineTotalEth)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
// Itemized as the requirement asks: subtotal, discount (only when there was
// one), network fee and total.
function Totals({ amounts }: { amounts: Order["amounts"] }) {
  const discounted = compareEth(amounts.discountEth, "0") > 0;
  return (
    <dl className="order-totals grid gap-[8px] mt-[16px] mr-[0] mb-[24px] ml-[0] min-[701px]:mt-[8px] min-[701px]:mr-[0] min-[701px]:mb-[24px] min-[701px]:ml-[35%] min-[701px]:pb-[12px] min-[701px]:border-b-[1px] min-[701px]:border-solid min-[701px]:border-b-[color:var(--border)] min-[701px]:text-[17px]">
      <div>
        <dt>Subtotal</dt>
        <dd>{eth(amounts.subtotalEth)}</dd>
      </div>
      {discounted && (
        <div>
          <dt>
            Desconto{amounts.couponCode ? ` (${amounts.couponCode})` : ""}
          </dt>
          <dd>(-) {eth(amounts.discountEth)}</dd>
        </div>
      )}
      <div>
        <dt>Taxa de rede</dt>
        <dd>{eth(amounts.networkFeeEth)}</dd>
      </div>
      <div className="amount-total">
        <dt>Total</dt>
        <dd>{eth(amounts.totalEth)}</dd>
      </div>
    </dl>
  );
}
