import { useState } from "react";
import { useSearch, useNavigate, useRouterState } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { categories, networks, type NftListQuery } from "@/contracts/nfts";
import { nftListOptions } from "@/data/nfts/queries";
import { discoverySearch } from "@/lib/discovery-search";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { NftCard, Skeleton, QueryError } from "@/components/discovery/shared";
import { Promotions } from "@/components/discovery/layout";
import { artImage, asset } from "@/components/discovery/assets";
const categoryNames: Record<string, string> = {
  art: "Arte digital",
  photography: "Fotografia",
  music: "Música",
  "3d": "Arte 3D",
  collectibles: "Colecionáveis",
  generative: "Generativa",
  gaming: "Jogos",
  memberships: "Assinaturas",
  utility: "Utilidade",
};
export function IndexPage() {
  const query = useSearch({ from: "/" });
  const navigate = useNavigate({ from: "/" });
  const [drawer, setDrawer] = useState(false);
  const searchOpen = useRouterState({
    select: (state) => state.location.hash === "busca",
  });
  const result = useQuery({
    ...nftListOptions(query),
    placeholderData: keepPreviousData,
  });
  function change(patch: Partial<NftListQuery>) {
    void navigate({
      search: discoverySearch({ ...query, ...patch, page: patch.page ?? 1 }),
      hash: "catalogo",
    });
  }
  return (
    <main id="main">
      <div
        className={`search-bar ${searchOpen ? "search-open" : ""}`}
        id="busca"
      >
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            change({ search: String(data.get("search") ?? "") });
          }}
        >
          <img src={asset("mobile-home-Search.svg")} alt="" />
          <input
            aria-label="Buscar NFTs"
            name="search"
            placeholder="Explorar coleções"
            defaultValue={query.search}
            key={query.search}
            maxLength={100}
          />
          <button type="submit">Buscar</button>
        </form>
        <Dialog open={drawer} onOpenChange={setDrawer}>
          <DialogTrigger className="filter-toggle" aria-label="Abrir filtros">
            <img src={asset("mobile-home-Filter.svg")} alt="" />
          </DialogTrigger>
          <DialogContent className="filter-drawer">
            <DialogTitle>Filtrar NFTs</DialogTitle>
            <DialogDescription>
              Escolha os filtros e aplique para atualizar o catálogo.
            </DialogDescription>
            <Filters
              key={JSON.stringify(query)}
              value={query}
              onApply={(next) => {
                change(next);
                setDrawer(false);
              }}
            />
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
          </DialogContent>
        </Dialog>
      </div>
      <section className="hero">
        <div>
          <p>Bem-vindo à Kurio</p>
          <h1>
            <span className="desktop-copy">
              SEJA DONO DO FUTURO
              <br />
              DA ARTE DIGITAL
            </span>
            <span className="mobile-copy">
              SEJA DONO DA
              <br />
              CULTURA DIGITAL
            </span>
          </h1>
          <p className="hero-description">
            Descubra NFTs selecionados de criadores emergentes e consagrados.
            Colecione arte digital rara, apoie artistas e tenha uma parte da
            cultura da internet.
          </p>
          <a className="button button-primary" href="#catalogo">
            EXPLORAR →
          </a>
        </div>
        <picture>
          <img
            {...artImage("emerald", "(max-width: 700px) 140px, 450px")}
            alt="Colecionável Emerald Ape com jaqueta verde e óculos"
            width="450"
            height="450"
            fetchPriority="high"
          />
        </picture>
      </section>
      <section
        className="catalog-layout"
        id="catalogo"
        aria-label="Catálogo de NFTs"
      >
        <aside>
          <Filters key={JSON.stringify(query)} value={query} onApply={change} />
          <div className="spotlight">
            <h2>NFT EM DESTAQUE</h2>
            <p>OFERTA LIMITADA</p>
            <img
              {...artImage("sage", "300px")}
              width="300"
              height="360"
              alt="Sage Nomad"
            />
          </div>
        </aside>
        <div className="catalog-content">
          <div className="catalog-toolbar">
            <div className="modes" aria-label="Modo da listagem">
              {(
                [
                  ["all", "Todos os NFTs"],
                  ["new", "Novos lançamentos"],
                  ["trending", "Em alta"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  aria-pressed={query.mode === mode}
                  onClick={() => change({ mode })}
                >
                  {label}
                </button>
              ))}
            </div>
            <label>
              Ordenar por{" "}
              <select
                aria-label="Ordenar NFTs"
                value={query.sort}
                onChange={(e) =>
                  change({ sort: e.target.value as NftListQuery["sort"] })
                }
              >
                <option value="newest">
                  {query.mode === "trending"
                    ? "Popularidade"
                    : "Listados recentemente"}
                </option>
                <option value="price-asc">Menor preço</option>
                <option value="price-desc">Maior preço</option>
                <option value="name-asc">Nome</option>
              </select>
            </label>
          </div>
          {result.isPending ? (
            <Skeleton />
          ) : !result.data ? (
            <QueryError retry={() => void result.refetch()} />
          ) : (
            <>
              {result.isError && (
                <p role="alert">
                  Não foi possível atualizar os resultados.{" "}
                  <Button variant="ghost" onClick={() => void result.refetch()}>
                    Tentar novamente
                  </Button>
                </p>
              )}
              <p className="results-count" role="status">
                {result.data.pagination.total} NFTs encontrados{" "}
                {result.isFetching ? "• Atualizando…" : ""}
              </p>
              {result.data.data.length ? (
                <div className="nft-grid">
                  {result.data.data.map((nft) => (
                    <NftCard nft={nft} key={nft.id} />
                  ))}
                </div>
              ) : (
                <section className="empty">
                  <h2>Nenhum NFT encontrado</h2>
                  <p>Tente outra busca ou limpe os filtros.</p>
                  <Button onClick={() => change(discoverySearch({}))}>
                    Limpar filtros
                  </Button>
                </section>
              )}
              <nav className="pagination" aria-label="Paginação">
                <Button
                  variant="outline"
                  disabled={query.page === 1 || result.isPlaceholderData}
                  onClick={() => change({ page: query.page - 1 })}
                >
                  Anterior
                </Button>
                {Array.from(
                  { length: Math.min(result.data.pagination.pages, 20) },
                  (_, i) => (
                    <button
                      key={i}
                      aria-label={`Página ${i + 1}`}
                      aria-current={query.page === i + 1 ? "page" : undefined}
                      onClick={() => change({ page: i + 1 })}
                    >
                      {i + 1}
                    </button>
                  ),
                )}
                <Button
                  variant="outline"
                  disabled={
                    query.page >= result.data.pagination.pages ||
                    result.isPlaceholderData
                  }
                  onClick={() => change({ page: query.page + 1 })}
                >
                  Próxima
                </Button>
              </nav>
            </>
          )}
        </div>
      </section>
      <Promotions />
    </main>
  );
}
function Filters({
  value,
  onApply,
}: {
  value: NftListQuery;
  onApply: (next: Partial<NftListQuery>) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState("");
  return (
    <form
      className="filters"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          const clean = discoverySearch(draft);
          if (
            clean.minPrice !== draft.minPrice ||
            clean.maxPrice !== draft.maxPrice
          ) {
            setError("Informe uma faixa de preço válida em ETH.");
            return;
          }
          onApply(clean);
        } catch {
          setError("Verifique os filtros.");
        }
      }}
    >
      <fieldset>
        <legend>Coleções</legend>
        {categories.map((c) => (
          <label key={c}>
            <input
              type="radio"
              name="category"
              value={c}
              checked={draft.category === c}
              onChange={() => setDraft({ ...draft, category: c })}
            />
            {categoryNames[c]}
          </label>
        ))}
        <label>
          <input
            type="radio"
            name="category"
            checked={!draft.category}
            onChange={() => setDraft({ ...draft, category: "" })}
          />
          Todas
        </label>
      </fieldset>
      <fieldset>
        <legend>Faixa de preço</legend>
        <label>
          Mínimo (ETH)
          <input
            inputMode="decimal"
            value={draft.minPrice}
            onChange={(e) => setDraft({ ...draft, minPrice: e.target.value })}
          />
        </label>
        <label>
          Máximo (ETH)
          <input
            inputMode="decimal"
            value={draft.maxPrice}
            onChange={(e) => setDraft({ ...draft, maxPrice: e.target.value })}
          />
        </label>
      </fieldset>
      <fieldset>
        <legend>Rede</legend>
        {networks.map((n) => (
          <label key={n}>
            <input
              type="radio"
              name="network"
              checked={draft.network === n}
              onChange={() => setDraft({ ...draft, network: n })}
            />
            {n[0].toUpperCase() + n.slice(1)}
          </label>
        ))}
        <label>
          <input
            type="radio"
            name="network"
            checked={!draft.network}
            onChange={() => setDraft({ ...draft, network: "" })}
          />
          Todas as redes
        </label>
      </fieldset>
      {error && <p role="alert">{error}</p>}
      <Button type="submit">Aplicar</Button>
      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          const next = discoverySearch({});
          setDraft(next);
        }}
      >
        Limpar filtros
      </Button>
    </form>
  );
}
