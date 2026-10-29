import { discoverySearch } from "@/lib/discovery-search";
import { useEffect, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import * as Tabs from "@radix-ui/react-tabs";
import axios from "axios";
import { nftDetailOptions, relatedOptions } from "@/data/nfts/queries";
import type { Nft } from "@/contracts/nfts";
import { ethUnits } from "@/contracts/eth";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  NftCard,
  QueryError,
  Skeleton,
  Unavailable,
} from "@/components/discovery/shared";
import { artImage, asset } from "@/components/discovery/assets";
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
  const total =
    edition && !conflict ? ethUnits(edition.priceEth) * BigInt(quantity) : 0n;
  const totalText =
    `${total / 10n ** 18n}.${(total % 10n ** 18n).toString().padStart(18, "0")}`.replace(
      /\.?0+$/,
      "",
    );
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
      <div className="breadcrumbs">
        <Link to="/" search={discoverySearch({})}>
          Início
        </Link>{" "}
        /{" "}
        <Link to="/" search={discoverySearch({})} hash="catalogo">
          Mercado
        </Link>
      </div>
      <section className="product">
        <div className="gallery">
          <div className="thumbnails" aria-label="Galeria do NFT">
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
        <div className="product-info">
          <h1>{nft.name}</h1>
          <div className="price-reviews">
            <p className="price">{edition?.priceEth ?? "—"} ETH</p>
            <a href="#avaliacoes">
              <img src={asset("detail-Star.svg")} alt="" />{" "}
              {nft.reviews.length
                ? (
                    nft.reviews.reduce((sum, r) => sum + r.rating, 0) /
                    nft.reviews.length
                  ).toFixed(1)
                : "—"}{" "}
              ({nft.reviews.length} avaliações)
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
            <p role="status" className="change-notice">
              Preço ou disponibilidade deste NFT foi atualizado. Confira a
              edição e a quantidade antes de continuar.
            </p>
          )}
          {conflict && (
            <div role="alert" className="change-notice">
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
          <div className="purchase-bar">
            <div className="quantity">
              <label htmlFor="quantity">Qtd.</label>
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
            <p className="price mobile-price">{edition?.priceEth ?? "—"} ETH</p>
            {conflict ? (
              <Button disabled>Comprar NFT</Button>
            ) : (
              <Unavailable
                className="button button-primary"
                label="Comprar NFT"
              >
                Comprar NFT
              </Unavailable>
            )}
            <Unavailable
              className="button button-outline"
              label="Adicionar ao carrinho"
            >
              Adicionar ao carrinho
            </Unavailable>
          </div>
          {quantity > 1 && !conflict && (
            <p>
              Total da seleção: <span className="price">{totalText} ETH</span>
            </p>
          )}
          <p className="selection-limit">
            Disponíveis: {edition?.available ?? 0} • Limite por compra:{" "}
            {edition?.purchaseLimit ?? 0}
          </p>
          <dl className="nft-facts">
            <dt>ID do token:</dt>
            <dd>#{nft.tokenId}</dd>
            <dt>Coleção:</dt>
            <dd>{nft.collection.name}</dd>
            <dt>Atributos:</dt>
            <dd>{nft.attributes.map((a) => a.value).join(", ")}</dd>
          </dl>
          <div className="share">
            <Button variant="ghost" onClick={() => void share()}>
              Compartilhar este NFT ↗
            </Button>
            <Unavailable
              label="Favoritar NFT"
              className="button button-outline"
            >
              ♡ Favoritar
            </Unavailable>
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
            <dd>{nft.network}</dd>
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
