import { useRef, useState } from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  categories,
  networks,
  type NftListQuery,
  type NftListResponse,
} from "@/contracts/nfts";
import type { Eth } from "@/contracts/common";
import { ethUnits, formatEth, fromEthUnits, isEth } from "@/contracts/eth";
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
// Also rendered behind the login/signup modal, so the search is read without
// the route constraint and normalized (other routes fall back to defaults).
export function IndexPage() {
  const query = discoverySearch(useSearch({ strict: false }));
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState(false);
  const result = useQuery({
    ...nftListOptions(query),
    placeholderData: keepPreviousData,
  });
  function show(next: NftListQuery) {
    void navigate({ to: "/", search: discoverySearch(next), hash: "catalogo" });
  }
  // Search, filters, mode and sort restart the pagination, even when the
  // patch carries a page (the filter form sends its whole draft).
  function change(patch: Partial<NftListQuery>) {
    show({ ...query, ...patch, page: 1 });
  }
  const goToPage = (page: number) => show({ ...query, page });
  return (
    <main id="main">
      <div className="search-bar hidden gap-[12px] items-center max-[701px]:gap-[8px] max-[701px]:flex max-[701px]:sticky max-[701px]:top-[0] max-[701px]:z-[35] max-[701px]:bg-[color:var(--background)]">
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
              facets={result.data?.facets}
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
      <section className="hero flex min-h-[450px] pt-[0] pr-[0] pb-[0] pl-[40px] gap-[48px] mb-[96px] max-[1101px]:gap-[24px] max-[1101px]:pl-[16px] max-[701px]:min-h-[190px] max-[701px]:p-[16px] max-[701px]:gap-[0] max-[701px]:rounded-[28px] max-[701px]:mb-[16px]">
        <div>
          <p>Bem-vindo à Kurio</p>
          <h1>
            <span className="desktop-copy max-[701px]:hidden">
              SEJA DONO DO FUTURO
              <br />
              DA ARTE DIGITAL
            </span>
            <span className="mobile-copy hidden max-[701px]:inline">
              SEJA DONO DA
              <br />
              CULTURA DIGITAL
            </span>
          </h1>
          <p className="hero-description text-[color:var(--muted-foreground)] max-[701px]:text-[color:var(--foreground)] max-w-[557px] max-[701px]:text-[12px] max-[701px]:leading-[18px] max-[701px]:max-h-[54px] max-[701px]:overflow-hidden">
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
        className="catalog-layout grid grid-cols-[310px_minmax(0,1fr)] gap-[48px] max-[1101px]:grid-cols-[240px_minmax(0,1fr)] max-[1101px]:gap-[24px] max-[701px]:block"
        id="catalogo"
        aria-label="Catálogo de NFTs"
      >
        <aside>
          <Filters
            key={JSON.stringify(query)}
            value={query}
            facets={result.data?.facets}
            onApply={change}
            instant
          />
          <div className="spotlight mt-[24px] bg-[color:var(--surface)] text-center pt-[20px] text-[color:var(--accent)]">
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
          <div className="catalog-toolbar flex gap-[20px] flex-wrap text-[12px] max-[701px]:gap-[12px]">
            <div
              className="modes flex gap-[16px] flex-wrap max-[701px]:gap-[8px] max-[701px]:flex-nowrap max-[701px]:w-[100%]"
              aria-label="Modo da listagem"
            >
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
              <p
                className="results-count text-[color:var(--muted-foreground)] text-[11px] my-[12px] mx-[0] max-[701px]:text-[10px]"
                role="status"
              >
                {result.data.pagination.total} NFTs encontrados{" "}
                {result.isFetching ? "• Atualizando…" : ""}
              </p>
              {result.data.data.length ? (
                <div className="nft-grid grid gap-[32px] max-[701px]:gap-y-[24px] max-[701px]:gap-x-[16px] max-[701px]:items-start">
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
                  onClick={() => goToPage(query.page - 1)}
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
                      onClick={() => goToPage(i + 1)}
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
                  onClick={() => goToPage(query.page + 1)}
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
  facets,
  onApply,
  instant,
}: {
  value: NftListQuery;
  facets?: NftListResponse["facets"];
  onApply: (next: Partial<NftListQuery>) => void;
  // Sidebar: collection and network apply on choice; Aplicar is only for the
  // price. The mobile drawer keeps everything as a draft until Aplicar.
  instant?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState("");
  function pick(patch: Partial<NftListQuery>) {
    setDraft({ ...draft, ...patch });
    if (instant) onApply(patch);
  }
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
      <fieldset className="filter-options">
        <legend>Coleções</legend>
        {categories.map((c) => (
          <label key={c}>
            <input
              type="radio"
              name="category"
              value={c}
              checked={draft.category === c}
              onChange={() => pick({ category: c })}
            />
            <span>{categoryNames[c]}</span>
            {facets && <span>({facets.categories[c]})</span>}
          </label>
        ))}
        <label>
          <input
            type="radio"
            name="category"
            checked={!draft.category}
            onChange={() => pick({ category: "" })}
          />
          <span>Todas</span>
        </label>
      </fieldset>
      <fieldset>
        <legend>Faixa de preço</legend>
        <PriceRange
          bounds={facets?.price ?? null}
          min={draft.minPrice}
          max={draft.maxPrice}
          onChange={(minPrice, maxPrice) =>
            setDraft({ ...draft, minPrice, maxPrice })
          }
        />
        {error && <p role="alert">{error}</p>}
        <Button type="submit">Aplicar</Button>
      </fieldset>
      <fieldset className="filter-options">
        <legend>Rede</legend>
        {networks.map((n) => (
          <label key={n}>
            <input
              type="radio"
              name="network"
              checked={draft.network === n}
              onChange={() => pick({ network: n })}
            />
            <span>{n[0].toUpperCase() + n.slice(1)}</span>
            {facets && <span>({facets.networks[n]})</span>}
          </label>
        ))}
        <label>
          <input
            type="radio"
            name="network"
            checked={!draft.network}
            onChange={() => pick({ network: "" })}
          />
          <span>Todas as redes</span>
        </label>
      </fieldset>
      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          const next = discoverySearch({});
          setDraft(next);
          if (instant)
            onApply({
              category: "",
              network: "",
              minPrice: "",
              maxPrice: "",
            });
        }}
      >
        Limpar filtros
      </Button>
    </form>
  );
}
// Two thumbs over one track, in steps of 0.01 ETH between the lowest and
// highest price of the current results. A thumb at its end means "no limit",
// so the ends never cut off a price by rounding.
const cent = 10n ** 16n;
const cents = (value: Eth, up = false) => {
  const units = ethUnits(value);
  return Number(units / cent + (up && units % cent ? 1n : 0n));
};
function PriceRange({
  bounds,
  min,
  max,
  onChange,
}: {
  bounds: { min: Eth; max: Eth } | null;
  min: string;
  max: string;
  onChange: (min: string, max: string) => void;
}) {
  const low = bounds ? cents(bounds.min) : 0;
  const high = bounds ? Math.max(cents(bounds.max, true), low + 1) : 1;
  const clamp = (v: number) => Math.min(high, Math.max(low, v));
  const at = (value: string, fallback: number, up?: boolean) =>
    isEth(value) ? clamp(cents(value, up)) : fallback;
  const from = at(min, low);
  const to = Math.max(from, at(max, high, true));
  const eth = (v: number) => fromEthUnits(BigInt(v) * cent);
  const set = (a: number, b: number) =>
    onChange(a <= low ? "" : eth(a), b >= high ? "" : eth(b));
  const label = (v: number) => formatEth(eth(v));
  const percent = (v: number) => ((v - low) / (high - low)) * 100;
  const track = useRef<HTMLDivElement>(null);
  // Two separate 24 px thumbs (role="slider"), not two native ranges stacked
  // on one track: stacked inputs cover each other as touch targets.
  const move = (which: "from" | "to", v: number) =>
    which === "from"
      ? set(Math.min(clamp(v), to), to)
      : set(from, Math.max(clamp(v), from));
  const step = Math.max(1, Math.round((high - low) / 10));
  const keys: Record<string, (v: number) => number> = {
    ArrowLeft: (v) => v - 1,
    ArrowDown: (v) => v - 1,
    ArrowRight: (v) => v + 1,
    ArrowUp: (v) => v + 1,
    PageDown: (v) => v - step,
    PageUp: (v) => v + step,
    Home: () => low,
    End: () => high,
  };
  const thumb = (which: "from" | "to", value: number, name: string) => (
    <div
      role="slider"
      tabIndex={bounds ? 0 : -1}
      aria-label={name}
      aria-valuemin={low}
      aria-valuemax={high}
      aria-valuenow={value}
      aria-valuetext={`${label(value)} ETH`}
      aria-disabled={!bounds || undefined}
      className="price-thumb"
      style={{ left: `${percent(value)}%` }}
      onKeyDown={(e) => {
        const next = keys[e.key];
        if (!bounds || !next) return;
        e.preventDefault();
        move(which, next(value));
      }}
      onPointerDown={(e) => {
        if (!bounds) return;
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const box = track.current?.getBoundingClientRect();
        if (!box || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
        const ratio = (e.clientX - box.left) / box.width;
        move(which, Math.round(low + ratio * (high - low)));
      }}
    />
  );
  return (
    <div className="price-range">
      <div
        ref={track}
        className="price-track"
        style={{
          ["--from" as string]: `${percent(from)}%`,
          ["--to" as string]: `${percent(to)}%`,
        }}
      >
        {thumb("from", from, "Preço mínimo (ETH)")}
        {thumb("to", to, "Preço máximo (ETH)")}
      </div>
      <p aria-live="polite">
        {bounds
          ? `Preço: ${label(from)} – ${label(to)} ETH`
          : "Sem preços para os filtros atuais"}
      </p>
    </div>
  );
}
