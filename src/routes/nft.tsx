import { discoverySearch } from "@/lib/discovery-search";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import * as Tabs from "@radix-ui/react-tabs";
import axios from "axios";
import { nftDetailOptions, relatedOptions } from "@/data/nfts/queries";
import type { Nft } from "@/contracts/nfts";
import { multiplyEth } from "@/contracts/eth";
import { addCartItem } from "@/data/cart/api";
import { useCartMutation } from "@/data/cart/hooks";
import { apiError } from "@/lib/api-error";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { NftCard, QueryError, Skeleton } from "@/components/discovery/shared";
import { artImage, asset } from "@/components/discovery/assets";
import { FavoriteButton, HeartIcon } from "@/components/discovery/favorite";
export function NftPage() {
  const { nftId } = useParams({ from: "/nfts/$nftId" });
  const result = useQuery(nftDetailOptions(nftId));
  if (result.isPending)
    return (
      <main id="main">
        <Skeleton detail />
      </main>
    );
  if (result.isError)
    return (
      <main id="main">
        <QueryError
          missing={
            axios.isAxiosError(result.error) &&
            result.error.response?.status === 404
          }
          retry={() => void result.refetch()}
        />
      </main>
    );
  return <NftDetails key={nftId} nft={result.data.data} />;
}
function NftDetails({ nft }: { nft: Nft }) {
  const [image, setImage] = useState(0);
  const [selected, setSelected] = useState(
    nft.editions.find((e) => e.available > 0)?.id ?? "",
  );
  const [quantity, setQuantity] = useState(1);
  const [acknowledged, setAcknowledged] = useState(nft.version);
  const [shareStatus, setShareStatus] = useState("");
  const related = useQuery(relatedOptions(nft.id));
  const rating = nft.reviews.length
    ? nft.reviews.reduce((sum, r) => sum + r.rating, 0) / nft.reviews.length
    : 0;
  const reviewCount = `${nft.reviews.length} ${
    nft.reviews.length === 1 ? "avaliação" : "avaliações"
  } de colecionadores`;
  const pageUrl = encodeURIComponent(window.location.href);
  const edition = nft.editions.find((e) => e.id === selected);
  const limit = edition
    ? Math.min(edition.available, edition.purchaseLimit)
    : 0;
  const conflict =
    !edition ||
    edition.available === 0 ||
    quantity > limit ||
    quantity < 1 ||
    !Number.isInteger(quantity);
  const totalText =
    edition && !conflict ? multiplyEth(edition.priceEth, quantity) : "0";
  const add = useCartMutation(addCartItem);
  const navigate = useNavigate();
  const [cartError, setCartError] = useState("");
  // Buying adds the selection to the cart and opens it; a refusal (limit,
  // stock) is explained here and nothing changes.
  async function buy() {
    if (!edition || conflict) return;
    setCartError("");
    try {
      await add.mutateAsync({
        nftId: nft.id,
        editionId: edition.id,
        quantity,
      });
      await navigate({ to: "/cart" });
    } catch (error) {
      setCartError(apiError(error).message);
    }
  }
  useEffect(() => {
    document.title = `${nft.name} | KURIO`;
    return () => {
      document.title = "KURIO | Marketplace de NFTs";
    };
  }, [nft.name]);
  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: nft.name, url });
        setShareStatus("Link compartilhado.");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          setShareStatus("Compartilhamento cancelado.");
          return;
        }
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareStatus("Link copiado.");
    } catch {
      setShareStatus(
        `Não foi possível copiar automaticamente. Copie este link: ${url}`,
      );
    }
  }

  return (
    <main id="main">
      <div className="breadcrumbs font-bold max-[701px]:text-[12px]">
        <Link to="/" search={discoverySearch({})}>
          Início
        </Link>{" "}
        /{" "}
        <Link to="/" search={discoverySearch({})} hash="catalogo">
          Mercado
        </Link>
      </div>
      <section className="product grid grid-cols-[1fr_1fr] gap-[32px] max-[701px]:flex max-[701px]:flex-col max-[701px]:gap-[16px] min-[701px]:max-[901px]:grid-cols-[1fr]">
        <div className="gallery">
          <div
            className="thumbnails flex gap-[16px] w-[100px] max-[1101px]:w-[60px] max-[701px]:w-[100%]"
            aria-label="Galeria do NFT"
          >
            {nft.gallery.map((art, i) => (
              <button
                key={i}
                aria-label={`Imagem ${i + 1}`}
                aria-pressed={image === i}
                onClick={() => setImage(i)}
              >
                <img
                  {...artImage(art, "(max-width: 700px) 25vw, 100px")}
                  alt=""
                  width="100"
                  height="100"
                />
              </button>
            ))}
          </div>
          <Dialog>
            <DialogTrigger className="main-art" aria-label="Ampliar imagem">
              <img
                {...artImage(
                  nft.gallery[image],
                  "(max-width: 700px) 100vw, 404px",
                )}
                alt={nft.name}
                width="404"
                height="404"
                fetchPriority="high"
              />
              <span aria-hidden="true">
                <img src={asset("detail-Frame238.svg")} alt="" />
              </span>
            </DialogTrigger>
            <DialogContent className="lightbox">
              <DialogTitle>{nft.name}</DialogTitle>
              <DialogDescription>
                Imagem ampliada do NFT selecionado.
              </DialogDescription>
              <img
                {...artImage(nft.gallery[image], "min(600px, 100vw)")}
                alt={nft.name}
                width="600"
                height="600"
              />
            </DialogContent>
          </Dialog>
        </div>
        <div className="product-info max-[701px]:bg-[color:var(--surface)] max-[701px]:rounded-[32px] max-[701px]:p-[24px] max-[701px]:my-[0] max-[701px]:mx-[-24px]">
          <h1>{nft.name}</h1>
          <div className="price-reviews flex gap-[12px] flex-wrap max-[701px]:my-[12px] max-[701px]:mx-[0]">
            <p className="price">{edition?.priceEth ?? "—"} ETH</p>
            <a
              href="#avaliacoes"
              aria-label={`Nota ${rating.toFixed(1)} de 5, ${reviewCount}`}
            >
              <span className="stars" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((n) => (
                  <img
                    key={n}
                    src={asset("detail-Star.svg")}
                    alt=""
                    className={n <= Math.round(rating) ? "" : "opacity-30"}
                  />
                ))}
              </span>
              <span aria-hidden="true">{reviewCount}</span>
            </a>
          </div>
          <h2>Sobre este NFT:</h2>
          <p>{nft.description}</p>
          <fieldset className="editions">
            <legend>Edição:</legend>
            {nft.editions.map((e) => (
              <button
                key={e.id}
                disabled={e.available === 0}
                aria-pressed={selected === e.id}
                onClick={() => {
                  setSelected(e.id);
                  setQuantity(1);
                  setAcknowledged(nft.version);
                }}
              >
                {e.label}
                {e.available === 0 ? " — Esgotada" : ""}
              </button>
            ))}
          </fieldset>
          {nft.version !== acknowledged && (
            <p
              role="status"
              className="change-notice p-[12px] border-[1px] border-solid border-[color:var(--primary)] my-[12px] mx-[0] wrap-anywhere"
            >
              Preço ou disponibilidade deste NFT foi atualizado. Confira a
              edição e a quantidade antes de continuar.
            </p>
          )}
          {conflict && (
            <div
              role="alert"
              className="change-notice p-[12px] border-[1px] border-solid border-[color:var(--primary)] my-[12px] mx-[0] wrap-anywhere"
            >
              {!edition || edition.available === 0
                ? "A edição selecionada está indisponível. Escolha outra edição."
                : `Quantidade inválida. O limite atual é ${limit}.`}{" "}
              {limit > 0 && (
                <Button
                  onClick={() => {
                    setQuantity(Math.max(1, limit));
                    setAcknowledged(nft.version);
                  }}
                >
                  Corrigir quantidade
                </Button>
              )}
            </div>
          )}
          <div className="purchase-bar flex gap-[12px] flex-wrap items-center max-[701px]:z-[20] max-[701px]:bg-[color:var(--surface)] max-[701px]:grid max-[701px]:grid-cols-[1fr_1fr] max-[701px]:fixed">
            <div className="quantity">
              <label htmlFor="quantity" className="sr-only">
                Qtd.
              </label>
              <Button
                aria-label="Diminuir quantidade"
                disabled={quantity <= 1}
                onClick={() => setQuantity((q) => q - 1)}
              >
                −
              </Button>
              <input
                id="quantity"
                type="number"
                min="1"
                max={limit || 1}
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
              <Button
                aria-label="Aumentar quantidade"
                disabled={quantity >= limit || limit === 0}
                onClick={() => setQuantity((q) => q + 1)}
              >
                +
              </Button>
            </div>
            <p className="price mobile-price hidden max-[701px]:block max-[701px]:text-right">
              {edition?.priceEth ?? "—"} ETH
            </p>
            <Button
              className="buy-now"
              aria-label="Comprar NFT"
              disabled={conflict || add.isPending}
              aria-describedby="cart-feedback"
              onClick={() => void buy()}
            >
              Comprar
            </Button>
            <FavoriteButton
              nftId={nft.id}
              name={nft.name}
              className="button button-outline favorite-detail"
            >
              {(on) => (
                <>
                  <HeartIcon on={on} />
                  {on ? "Favoritado" : "Favoritar"}
                </>
              )}
            </FavoriteButton>
          </div>
          <p
            id="cart-feedback"
            role="status"
            className="cart-feedback is-error"
          >
            {cartError}
          </p>
          {quantity > 1 && !conflict && (
            <p>
              Total da seleção: <span className="price">{totalText} ETH</span>
            </p>
          )}
          <p className="selection-limit max-[701px]:text-[12px]">
            Disponíveis: {edition?.available ?? 0} • Limite por compra:{" "}
            {edition?.purchaseLimit ?? 0}
          </p>
          <dl className="nft-facts text-[color:var(--muted-foreground)] text-[14px] max-[701px]:text-[12px]">
            <div>
              <dt>ID do token:</dt> <dd>#{nft.tokenId}</dd>
            </div>
            <div>
              <dt>Coleção:</dt> <dd>{nft.collection.name}</dd>
            </div>
            <div>
              <dt>Atributos:</dt>{" "}
              <dd>{nft.attributes.map((a) => a.value).join(", ")}</dd>
            </div>
          </dl>
          <div className="share">
            <span>Compartilhar este NFT:</span>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${pageUrl}`}
              target="_blank"
              rel="noreferrer"
              aria-label="Compartilhar no LinkedIn"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.5h4V21H3V9.5Zm6.5 0h3.8v1.6h.06c.53-1 1.83-2.06 3.77-2.06 4.03 0 4.77 2.65 4.77 6.1V21h-4v-5.1c0-1.22-.02-2.78-1.7-2.78-1.7 0-1.96 1.33-1.96 2.7V21h-4V9.5Z" />
              </svg>
            </a>
            <a
              href={`mailto:?subject=${encodeURIComponent(nft.name)}&body=${pageUrl}`}
              aria-label="Compartilhar por e-mail"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="outline">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
            </a>
            <a
              href={`https://twitter.com/intent/tweet?url=${pageUrl}&text=${encodeURIComponent(nft.name)}`}
              target="_blank"
              rel="noreferrer"
              aria-label="Compartilhar no Twitter"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M23 5.1a8.6 8.6 0 0 1-2.5.7 4.4 4.4 0 0 0 1.9-2.4 8.8 8.8 0 0 1-2.8 1.1 4.4 4.4 0 0 0-7.5 4A12.4 12.4 0 0 1 3 4a4.4 4.4 0 0 0 1.4 5.9 4.3 4.3 0 0 1-2-.6v.1a4.4 4.4 0 0 0 3.5 4.3 4.4 4.4 0 0 1-2 .1 4.4 4.4 0 0 0 4.1 3A8.8 8.8 0 0 1 1 18.6 12.4 12.4 0 0 0 7.8 20.6c8 0 12.4-6.7 12.4-12.4v-.6A8.8 8.8 0 0 0 23 5.1Z" />
              </svg>
            </a>
            <button type="button" onClick={() => void share()}>
              Copiar link
            </button>
          </div>
          <p role="status">{shareStatus}</p>
        </div>
      </section>
      <Tabs.Root defaultValue="details" className="detail-tabs">
        <Tabs.List aria-label="Informações do NFT">
          <Tabs.Trigger value="details">Detalhes do NFT</Tabs.Trigger>
          <Tabs.Trigger value="reviews" id="avaliacoes">
            Avaliações de colecionadores ({nft.reviews.length})
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="details">
          <p>{nft.fullDescription}</p>
          <dl>
            <dt>Rede:</dt>
            <dd>{nft.network[0].toUpperCase() + nft.network.slice(1)}</dd>
            <dt>Contrato:</dt>
            <dd>{nft.metadata.contract}</dd>
            <dt>Padrão do token:</dt>
            <dd>{nft.metadata.standard}</dd>
            <dt>Direitos autorais / Royalty:</dt>
            <dd>{nft.metadata.royalty} nas vendas secundárias simuladas.</dd>
            <dt>Procedência:</dt>
            <dd>{nft.metadata.provenance}</dd>
          </dl>
        </Tabs.Content>
        <Tabs.Content value="reviews">
          {nft.reviews.map((r) => (
            <article key={r.id}>
              <h3>
                {r.author} • {r.rating}/5
              </h3>
              <p>{r.content}</p>
            </article>
          ))}
        </Tabs.Content>
      </Tabs.Root>
      <section className="related">
        <h2>Mais desta coleção</h2>
        {related.isPending ? (
          <Skeleton />
        ) : related.isError ? (
          <QueryError retry={() => void related.refetch()} />
        ) : (
          <div>
            {related.data.map((n) => (
              <NftCard key={n.id} nft={n} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
