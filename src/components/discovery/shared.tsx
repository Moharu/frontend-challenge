import { discoverySearch } from "@/lib/discovery-search";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { Nft } from "@/contracts/nfts";
import { lowestPrice } from "@/contracts/nfts";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { artImage } from "./assets";
import { FavoriteButton } from "./favorite";
export function Unavailable({
  children,
  label,
  className = "",
  description,
}: {
  children: ReactNode;
  label: string;
  className?: string;
  description?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className={className} aria-label={label}>
          {children}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Funcionalidade indisponível</DialogTitle>
        <DialogDescription>
          {description ??
            `${label} ainda não está disponível nesta versão. ` +
              "Esta demonstração inclui a descoberta pública de NFTs e o carrinho de visitante."}
        </DialogDescription>
      </DialogContent>
    </Dialog>
  );
}
export function NftCard({ nft }: { nft: Nft }) {
  return (
    <article className="nft-card">
      <div className="card-art">
        <Link
          to="/nfts/$nftId"
          params={{ nftId: nft.id }}
          aria-label={`Ver ${nft.name}`}
        >
          <img
            {...artImage(nft.artwork, "(max-width: 700px) 50vw, 300px")}
            width="300"
            height="300"
            alt={nft.name}
            loading="lazy"
          />
        </Link>
        <FavoriteButton nftId={nft.id} name={nft.name} />
        {nft.discovery.rarity && (
          <span className="rarity">{nft.discovery.rarity}</span>
        )}
      </div>
      <Link to="/nfts/$nftId" params={{ nftId: nft.id }}>
        {nft.name}
      </Link>
      <p className="price">{lowestPrice(nft)} ETH</p>
    </article>
  );
}
export function Skeleton({ detail = false }: { detail?: boolean }) {
  return (
    <div
      aria-label="Carregando NFTs"
      role="status"
      className={detail ? "detail-skeleton skeleton" : "skeleton-grid"}
    >
      {Array.from({ length: detail ? 1 : 6 }, (_, i) => (
        <div className="skeleton" key={i} />
      ))}
    </div>
  );
}
export function QueryError({
  retry,
  missing = false,
}: {
  retry: () => void;
  missing?: boolean;
}) {
  return (
    <section className="query-error" role="alert">
      <h1>
        {missing ? "NFT não encontrado" : "Não foi possível carregar os NFTs"}
      </h1>
      <p>
        {missing
          ? "Este NFT não existe no catálogo."
          : "Ocorreu uma falha de conexão. Tente novamente."}
      </p>
      {!missing && <Button onClick={retry}>Tentar novamente</Button>}
      <Link to="/" search={discoverySearch({})}>
        Voltar ao catálogo
      </Link>
    </section>
  );
}
