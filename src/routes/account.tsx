import { useEffect, useRef, useState } from "react";
import {
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { signOut } from "@/data/session/identity";
import { useFavorites } from "@/data/account/hooks";
import { nftDetailOptions } from "@/data/nfts/queries";
import { discoverySearch } from "@/lib/discovery-search";
import { NftCard, Skeleton } from "@/components/discovery/shared";
// Account sections, in the frame's order. The four sections outside this
// version are real pages (inside this layout) that say so honestly.
const sections = [
  { to: "/account/profile", label: "Dados do perfil", icon: "user" },
  { to: "/account/wallets", label: "Carteiras", icon: "pin" },
  { to: "/account/activity", label: "Atividade", icon: "cart" },
  { to: "/account/favorites", label: "Lista de interesse", icon: "heart" },
  { to: "/account/offers", label: "Ofertas", icon: "offer" },
  { to: "/account/downloads", label: "Arquivos baixados", icon: "download" },
  { to: "/account/support", label: "Suporte", icon: "alert" },
] as const;
type Icon = (typeof sections)[number]["icon"] | "logout";
// Outline icons in the frame's style (the file exported none for this menu).
const iconPaths: Record<Icon, string> = {
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
  pin: "M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Zm0-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  cart: "M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 7H6.2M9 19.5h.01M17 19.5h.01",
  heart:
    "M12 20s-7.5-4.6-9-9.3C2 7.5 4 4.5 7.2 4.5c2 0 3.5 1.2 4.8 3 1.3-1.8 2.8-3 4.8-3C20 4.5 22 7.5 21 10.7 19.5 15.4 12 20 12 20Z",
  offer: "M20 12a8 8 0 1 1-5-7.4M7.5 14l3-3 2.5 2.5L17 9.5M18.5 4.5h.01",
  download: "M12 4v10m0 0-4-4m4 4 4-4M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3",
  alert: "M12 4 2.5 20h19L12 4Zm0 6v4m0 3h.01",
  logout: "M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M9 16l-4-4 4-4M5 12h11",
};
function MenuIcon({ name }: { name: Icon }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={iconPaths[name]} />
    </svg>
  );
}
// Desktop: the "Meu perfil" sidebar. Mobile (up to 700px): a disclosure
// "Meu perfil · <section> ▾" above the content that expands the same list
// inline and collapses after a choice, returning focus to the button.
export function AccountLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = sections.find((s) => s.to === pathname);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const choose = () => {
    if (!open) return;
    setOpen(false);
    requestAnimationFrame(() => toggle.current?.focus());
  };
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    document.title = `${current?.label ?? "Minha conta"} | KURIO`;
  }, [current]);
  // Mobile: the open list floats over the page; a tap outside closes it.
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!nav.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return (
    <main id="main" className="account-page">
      <nav
        ref={nav}
        className="account-nav"
        aria-label="Meu perfil"
        onKeyDown={(event) => {
          // Escape closes the open list and returns focus to the button.
          if (event.key === "Escape" && open) {
            setOpen(false);
            toggle.current?.focus();
          }
        }}
      >
        <button
          ref={toggle}
          type="button"
          className="account-disclosure"
          aria-expanded={open}
          aria-controls="account-sections"
          onClick={() => setOpen((value) => !value)}
        >
          Meu perfil
          {current && <span> · {current.label}</span>}
          <span aria-hidden="true">▾</span>
        </button>
        <p className="account-nav-title" aria-hidden="true">
          Meu perfil
        </p>
        <ul
          id="account-sections"
          className={open ? "account-sections open" : "account-sections"}
        >
          {sections.map((section) => (
            <li key={section.to}>
              <Link
                to={section.to}
                activeProps={{ "aria-current": "page" }}
                onClick={choose}
              >
                <MenuIcon name={section.icon} />
                {section.label}
              </Link>
            </li>
          ))}
          <li className="account-signout">
            <button
              type="button"
              onClick={() => {
                void signOut();
                void navigate({ to: "/", search: discoverySearch({}) });
              }}
            >
              <MenuIcon name="logout" />
              Sair
            </button>
          </li>
        </ul>
      </nav>
      <div className="account-content">
        <Outlet />
      </div>
    </main>
  );
}
// Sections outside this version: no fictional activity, offers or files,
// and no empty lists that would suggest a ready feature without data.
function NotAvailable({ title }: { title: string }) {
  return (
    <section className="account-section" aria-labelledby="account-title">
      <h1 id="account-title">{title}</h1>
      <p className="account-unavailable">
        Esta seção não está disponível nesta versão.
      </p>
      <Link className="account-link" to="/account/profile">
        Ir para Dados do perfil
      </Link>
    </section>
  );
}
export const ActivityPage = () => <NotAvailable title="Atividade" />;
export const OffersPage = () => <NotAvailable title="Ofertas" />;
export const DownloadsPage = () => <NotAvailable title="Arquivos baixados" />;
export const SupportPage = () => <NotAvailable title="Suporte" />;
// "Lista de interesse": the favorited NFTs with the catalog cards, current
// price and availability (detail queries, kept fresh by `nft.updated`).
export function FavoritesPage() {
  const favorites = useFavorites();
  const ids = favorites.data?.map((f) => f.nftId) ?? [];
  const details = useQueries({
    queries: ids.map((id) => nftDetailOptions(id)),
  });
  const failed = favorites.isError || details.some((d) => d.isError);
  const loading =
    favorites.isPending || details.some((d) => d.isPending && !d.data);
  return (
    <section className="account-section" aria-labelledby="account-title">
      <h1 id="account-title">Lista de interesse</h1>
      {failed ? (
        <div className="query-error" role="alert">
          <p>Não foi possível carregar sua lista de interesse.</p>
          <button
            className="button button-outline"
            onClick={() => {
              void favorites.refetch();
              details.forEach((d) => d.isError && void d.refetch());
            }}
          >
            Tentar novamente
          </button>
        </div>
      ) : loading ? (
        <Skeleton />
      ) : ids.length === 0 ? (
        <div className="account-empty">
          <p>Você ainda não favoritou nenhum NFT.</p>
          <Link
            className="button button-primary"
            to="/"
            search={discoverySearch({})}
            hash="catalogo"
          >
            Explorar o catálogo
          </Link>
        </div>
      ) : (
        <div className="nft-grid account-favorites">
          {details.map(
            (d) => d.data && <NftCard key={d.data.data.id} nft={d.data.data} />,
          )}
        </div>
      )}
    </section>
  );
}
