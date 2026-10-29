import { discoverySearch } from "@/lib/discovery-search";
import { useEffect } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { queryClient } from "@/lib/query-client";
import { readEnv } from "@/lib/env";
import type { CatalogRealtime } from "@/realtime/catalog";
import { Unavailable } from "./shared";
import { asset, artImage } from "./assets";
export function PublicLayout() {
  const home = useRouterState({
    select: (state) => state.location.pathname === "/",
  });
  useEffect(() => {
    let disposed = false;
    let live: CatalogRealtime | undefined;
    // Socket.IO must load after MSW installs its WebSocket interception.
    void import("@/realtime/catalog").then(({ createCatalogRealtime }) => {
      if (disposed) return;
      live = createCatalogRealtime(queryClient, readEnv().apiBaseURL);
      live.connect();
    });
    return () => {
      disposed = true;
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
            <Link
              className={home ? "active" : ""}
              to="/"
              search={discoverySearch({})}
            >
              Início
            </Link>
            <Link
              className={!home ? "active" : ""}
              to="/"
              search={discoverySearch({})}
              hash="catalogo"
            >
              Mercado
            </Link>
            <Unavailable label="Criadores">Criadores</Unavailable>
            <Unavailable label="Aprenda">Aprenda</Unavailable>
          </nav>
          <div className="header-actions">
            <Link
              to="/"
              search={discoverySearch({})}
              hash="busca"
              aria-label="Buscar NFTs"
            >
              <img src={asset("home-SearchIcon.svg")} alt="" />
            </Link>
            <Unavailable label="Carrinho">
              <img src={asset("home-CartIcon.svg")} alt="" />
            </Unavailable>
            <Unavailable className="button button-primary" label="Entrar">
              Entrar
            </Unavailable>
          </div>
        </header>
        <div className="route-content">
          <Outlet />
        </div>
        <Footer />
      </div>
      <nav className="mobile-nav" aria-label="Navegação mobile">
        <Link to="/" search={discoverySearch({})} aria-label="Início">
          <img src={asset("mobile-home-Home.svg")} alt="" />
        </Link>
        <Unavailable label="Favoritos">
          <img src={asset("mobile-home-Vector1.svg")} alt="" />
        </Unavailable>
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
        <Unavailable label="Carrinho">
          <img src={asset("mobile-home-Shop.svg")} alt="" />
        </Unavailable>
        <Unavailable label="Minha conta">
          <img src={asset("mobile-home-User.svg")} alt="" />
        </Unavailable>
      </nav>
    </>
  );
}
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
            {items.map((item) => (
              <Unavailable key={item} label={item}>
                {item}
              </Unavailable>
            ))}
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
          <small>METAMASK • WALLETCONNECT • COINBASE</small>
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
