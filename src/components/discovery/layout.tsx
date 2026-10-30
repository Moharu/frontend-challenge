import { discoverySearch } from "@/lib/discovery-search";
import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  Link,
  Outlet,
  useLinkProps,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { queryClient } from "@/lib/query-client";
import { readEnv } from "@/lib/env";
import type { CatalogRealtime } from "@/realtime/catalog";
import { setRealtime } from "@/realtime/instance";
import { Unavailable } from "./shared";
import { AccountArea, MobileAccount, ExpiryRedirect, Notices } from "./account";
import {
  subscribeIdentity,
  getIdentity,
  useIdentity,
} from "@/data/session/identity";
import { authLink, openedOnLoad } from "@/lib/redirect";
import { asset, artImage } from "./assets";
import { badgeText, cartCountLabel, useCart } from "@/data/cart/hooks";
// The auth dialog opened over the current page, in its own chunk. It starts
// loading at once when the page was reloaded with the dialog open (so mobile
// does not show the page before the full-screen dialog), and otherwise right
// after the first render (idle callbacks can wait seconds while the realtime
// socket is active), so the first "Entrar" does not wait for the network.
// Once loaded, the component is rendered directly: going through `lazy` would
// suspend once anyway, and React holds a revealed Suspense fallback for about
// 300ms, which made the first opening noticeably slower.
let authModule: typeof import("@/routes/auth") | null = null;
const loadAuth = () =>
  import("@/routes/auth").then((m) => {
    authModule = m;
    return m;
  });
if (openedOnLoad || /^\/(login|signup)$/.test(window.location.pathname))
  void loadAuth();
const LazyAuthOverlay = lazy(() =>
  loadAuth().then((m) => ({ default: m.AuthOverlay })),
);
function AuthOverlay({ mode }: { mode: "login" | "signup" }) {
  if (authModule) return <authModule.AuthOverlay mode={mode} />;
  return (
    <Suspense fallback={<div className="auth-pending" aria-hidden="true" />}>
      <LazyAuthOverlay mode={mode} />
    </Suspense>
  );
}
function usePrefetchAuth() {
  useEffect(() => {
    // After the page's own load (LCP image, fonts), never competing with it.
    let id = 0;
    const prefetch = () => {
      id = window.setTimeout(() => void loadAuth(), 0);
    };
    if (document.readyState === "complete") prefetch();
    else window.addEventListener("load", prefetch, { once: true });
    return () => {
      window.removeEventListener("load", prefetch);
      window.clearTimeout(id);
    };
  }, []);
}
// Início and Mercado both point at "/", so the router would mark both active.
// The active state comes from the scroll position instead, and both links keep
// the current filters (discoverySearch renormalizes the previous search, so other
// routes fall back to defaults). On the home page they also scroll.
function SectionLink({
  active,
  hash,
  home,
  children,
}: {
  active: boolean;
  hash?: string;
  home: boolean;
  children: ReactNode;
}) {
  const props = useLinkProps({ to: "/", search: discoverySearch, hash });
  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    props.onClick?.(event);
    // Only plain clicks the router handled (not new-tab clicks) also scroll.
    if (!home || !event.defaultPrevented) return;
    if (hash) document.getElementById(hash)?.scrollIntoView();
    else window.scrollTo({ top: 0 });
  }
  return (
    <a
      {...props}
      onClick={onClick}
      data-status={undefined}
      className={active ? "active" : undefined}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </a>
  );
}
// Desktop search expands inside the header. Submitting keeps the current
// filters, applies the term and returns to page 1 of the catalog.
function HeaderSearch() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  // Focus without scrolling: inside the sticky header, a plain focus() (or
  // autoFocus) scrolls the page back to the header's original position.
  useEffect(() => {
    if (open) input.current?.focus({ preventScroll: true });
  }, [open]);
  const term = useRouterState({
    select: (state) => discoverySearch(state.location.search).search,
  });
  function close() {
    setOpen(false);
    requestAnimationFrame(() => toggle.current?.focus({ preventScroll: true }));
  }
  function search(value: string) {
    void navigate({
      to: "/",
      search: (previous) =>
        discoverySearch({
          ...discoverySearch(previous),
          search: value,
          page: 1,
        }),
      hash: "catalogo",
    });
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    search(String(new FormData(event.currentTarget).get("search") ?? ""));
  }
  // × clears an active search (other filters stay) and closes; Escape only closes.
  function clear() {
    if (term) search("");
    close();
  }
  if (!open)
    return (
      <button
        ref={toggle}
        className="header-search-toggle"
        aria-label="Buscar NFTs"
        aria-expanded={false}
        onClick={() => setOpen(true)}
      >
        <img src={asset("home-SearchIcon.svg")} alt="" />
      </button>
    );
  return (
    // The field mounts with the current term each time it opens; it is not
    // remounted on submit, so focus stays in it.
    <form
      role="search"
      className="header-search"
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === "Escape") close();
      }}
    >
      <input
        name="search"
        aria-label="Buscar NFTs"
        placeholder="Explorar coleções"
        defaultValue={term}
        maxLength={100}
        ref={input}
      />
      <button type="submit" aria-label="Buscar">
        <img src={asset("home-SearchIcon.svg")} alt="" />
      </button>
      <button type="button" aria-label="Limpar busca" onClick={clear}>
        ×
      </button>
    </form>
  );
}
// Mercado is current while the catalog crosses the middle of the viewport.
function useCatalogInView(home: boolean) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!home) return;
    const catalog = document.getElementById("catalogo");
    if (!catalog) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "-50% 0px -50% 0px" },
    );
    observer.observe(catalog);
    return () => {
      observer.disconnect();
      setInView(false);
    };
  }, [home]);
  return inView;
}
// Badge shows the summed quantity; the accessible name carries the exact count.
function CartLink({ icon }: { icon: string }) {
  const cart = useCart();
  const count = cart.data?.itemCount ?? 0;
  return (
    <Link to="/cart" className="cart-link" aria-label={cartCountLabel(count)}>
      <img src={asset(icon)} alt="" />
      {count > 0 && (
        <span className="cart-badge" aria-hidden="true">
          {badgeText(count)}
        </span>
      )}
    </Link>
  );
}
export function PublicLayout() {
  const home = useRouterState({
    select: (state) => state.location.pathname === "/",
  });
  const inCatalog = useCatalogInView(home);
  const auth = useRouterState({ select: (state) => state.location.state.auth });
  usePrefetchAuth();
  useEffect(() => {
    let disposed = false;
    let live: CatalogRealtime | undefined;
    // Private listeners follow the session: a new identity (login, logout,
    // expiry, user switch) releases them and events of other generations are
    // ignored. No private event is emitted yet.
    const follow = () => {
      const { session, sessionToken } = getIdentity();
      live?.setIdentity(
        session && sessionToken
          ? {
              userId: session.user.id,
              generation: session.generation,
              token: sessionToken,
            }
          : null,
      );
    };
    const unsubscribe = subscribeIdentity(follow);
    // Socket.IO must load after MSW installs its WebSocket interception.
    void import("@/realtime/catalog").then(({ createCatalogRealtime }) => {
      if (disposed) return;
      live = createCatalogRealtime(queryClient, readEnv().apiBaseURL);
      setRealtime(live);
      follow();
      live.connect();
    });
    return () => {
      disposed = true;
      unsubscribe();
      setRealtime(null);
      live?.dispose();
    };
  }, []);

  return (
    <>
      <a className="skip-link" href="#main">
        Pular para o conteúdo
      </a>
      <div className="site">
        <header className="desktop-header">
          <Link className="brand" to="/" search={discoverySearch({})}>
            KURIO
          </Link>
          <nav aria-label="Principal">
            <SectionLink home={home} active={home && !inCatalog}>
              Início
            </SectionLink>
            <SectionLink
              home={home}
              hash="catalogo"
              active={!home || inCatalog}
            >
              Mercado
            </SectionLink>
            <Unavailable label="Criadores">Criadores</Unavailable>
            <Unavailable label="Aprenda">Aprenda</Unavailable>
          </nav>
          <div className="header-actions">
            <HeaderSearch />
            <CartLink icon="home-CartIcon.svg" />
            <AccountArea />
          </div>
        </header>
        <div className="route-content">
          <Outlet />
        </div>
        <Footer />
      </div>
      <nav className="mobile-nav" aria-label="Navegação mobile">
        <Link to="/" search={discoverySearch} aria-label="Início">
          <img src={asset("mobile-home-Home.svg")} alt="" />
        </Link>
        <FavoritesLink />

        <Unavailable
          label="Ação central indisponível"
          className="central-action"
        >
          <span className="central-symbol">
            {[2, 3, 4, 5, 6].map((n) => (
              <img
                key={n}
                className={`central-part-${n}`}
                src={asset(`mobile-home-Vector${n}.svg`)}
                alt=""
              />
            ))}
          </span>
        </Unavailable>
        <CartLink icon="mobile-home-Shop.svg" />
        <MobileAccount />
      </nav>
      {auth && <AuthOverlay mode={auth} />}
      <Notices />
      <ExpiryRedirect />
    </>
  );
}
// Favorites in the mobile navigation: the "Lista de interesse" (signed out,
// the login, returning to it).
function FavoritesLink() {
  const identity = useIdentity();
  const icon = <img src={asset("mobile-home-Vector1.svg")} alt="" />;
  return identity.session ? (
    <Link to="/account/favorites" aria-label="Lista de interesse">
      {icon}
    </Link>
  ) : (
    <Link
      {...authLink("login", "/account/favorites")}
      aria-label="Lista de interesse, entrar"
    >
      {icon}
    </Link>
  );
}
// Footer items with a real page; the others keep the unavailability notice.
const footerRoutes: Record<
  string,
  "/account/profile" | "/account/activity" | "/account/favorites"
> = {
  "Meu perfil": "/account/profile",
  Atividade: "/account/activity",
  "Lista de interesse": "/account/favorites",
};
function Footer() {
  return (
    <footer>
      <section className="footer-benefits">
        {[
          [
            "W",
            "Segurança da carteira",
            "Proteja sua carteira e colecione arte digital verificada com confiança.",
          ],
          [
            "C",
            "Criadores em destaque",
            "Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.",
          ],
          [
            "D",
            "Alertas de lançamentos",
            "Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.",
          ],
        ].map(([icon, title, text]) => (
          <div key={title}>
            <span className="benefit-icon">{icon}</span>
            <h2>{title}</h2>
            <p>{text}</p>
          </div>
        ))}
        <div>
          <h3>Antecipe-se ao próximo lançamento</h3>
          <label htmlFor="newsletter">E-mail para novidades</label>
          <input
            id="newsletter"
            type="email"
            placeholder="digite seu e-mail..."
          />
          <Unavailable
            className="button button-primary"
            label="Enviar newsletter"
          >
            Enviar
          </Unavailable>
          <p>
            Receba lançamentos selecionados, histórias de criadores e novidades
            do mercado.
          </p>
        </div>
      </section>
      <div className="footer-contact">
        <span className="brand">KURIO</span>
        <p>
          Feito para colecionadores,
          <br />
          criadores e cultura
        </p>
        <Unavailable label="Contato: contato@email.com">
          contato@email.com
        </Unavailable>
        <span>+55 11 4002 8922</span>
      </div>
      <div className="footer-links">
        {[
          [
            "Meu perfil",
            "Meu perfil",
            "Minha coleção",
            "Atividade",
            "Estúdio do criador",
            "Lista de interesse",
          ],
          [
            "Central de ajuda",
            "Central de ajuda",
            "Como comprar NFTs",
            "Carteira e segurança",
            "Política do mercado",
            "Denunciar item",
          ],
          [
            "Coleções",
            "Arte digital",
            "Fotografia",
            "Música",
            "Arte 3D",
            "Utilidade",
          ],
        ].map(([title, ...items]) => (
          <section key={title}>
            <h2>{title}</h2>
            {items.map((item) =>
              item in footerRoutes ? (
                // Account pages (signed out, the guard leads to the login).
                <Link key={item} to={footerRoutes[item]}>
                  {item}
                </Link>
              ) : (
                <Unavailable key={item} label={item}>
                  {item}
                </Unavailable>
              ),
            )}
          </section>
        ))}
        <section>
          <h3>Redes sociais</h3>
          <div className="socials">
            {[108, 109, 110, 111, 112].map((n, i) => (
              <Unavailable
                key={n}
                label={
                  ["Facebook", "Instagram", "Twitter", "LinkedIn", "YouTube"][i]
                }
              >
                <img src={asset(`home-Frame${n}.svg`)} alt="" />
              </Unavailable>
            ))}
          </div>
          <h3>Carteiras compatíveis</h3>
          <small className="wallet-badge">
            METAMASK • WALLETCONNECT • COINBASE
          </small>
        </section>
      </div>
      <p className="copyright">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  );
}
export function Promotions() {
  return (
    <>
      <section className="promotions" aria-label="Destaques">
        {[
          ["emerald", "Lançamentos gênesis de edição limitada"],
          ["ivory", "Arte digital selecionada à sua mão"],
        ].map(([art, title]) => (
          <Link
            to="/"
            search={discoverySearch({ mode: "new" })}
            hash="catalogo"
            key={title}
          >
            <img
              {...artImage(art, "(max-width: 700px) 45vw, 280px")}
              width="280"
              height="240"
              alt=""
            />
            <div>
              <h2>{title}</h2>
              <p>
                Explore novos artistas, coleções verificadas e uma arte que
                conta histórias.
              </p>
              <span className="button button-primary">Explorar →</span>
            </div>
          </Link>
        ))}
      </section>
      <section className="editorial">
        <h2>Diário da Cunhagem</h2>
        <p>
          Histórias, guias e análises para colecionadores bem informados e
          apaixonados pela cultura digital.
        </p>
        <div>
          {["ivory", "emerald", "sage", "golden"].map((art, i) => (
            <article key={art}>
              <img
                {...artImage(art, "(max-width: 700px) 50vw, 300px")}
                alt=""
                loading="lazy"
                width="300"
                height="180"
              />
              <small>12 de novembro | Leitura de 3 min</small>
              <h3>
                {
                  [
                    "Como funciona a propriedade de NFTs",
                    "Os artistas digitais para acompanhar",
                    "Raridade, atributos e procedência",
                    "Como proteger sua carteira",
                  ][i]
                }
              </h3>
              <Unavailable label="Ler mais →">Ler mais →</Unavailable>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
