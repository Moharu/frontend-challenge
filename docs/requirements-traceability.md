# Rastreabilidade dos requisitos

Leitura lado a lado com [`challenge-requirements.md`](challenge-requirements.md): mesma ordem e mesmos títulos, uma entrada por parágrafo, linha de tabela ou item de lista. Status: **atendido**, **parcial** ou **fora do escopo / não atendido**. Testes citados por arquivo e número ou título; mapa completo em [testes](testing.md).

# Desafio Frontend — Marketplace de NFTs

- **React e TypeScript, seguindo o Figma.** **Atendido**, com desvios documentados. React 19 e TypeScript estrito; telas compostas a partir dos frames autorizados, com assets exportados do arquivo. Fidelidade visual aprovada pelo usuário. Evidência: [ARCHITECTURE.md › Desvios do Figma](../ARCHITECTURE.md#desvios-do-figma), [descoberta](discovery.md), `tests/e2e/*-snapshots/`.
- **O que o desafio avalia.** Ver as entradas de cada seção e da seção 11.

## 1. Escopo

- **Descoberta, compra e conta, desktop e mobile, com dados simulados.** **Atendido.** Todos os fluxos rodam sobre REST e Socket.IO simulados com MSW; nenhuma integração real com blockchain, carteira ou pagamento. Evidência: [ARCHITECTURE.md](../ARCHITECTURE.md), [cenários](mock-scenarios.md), suíte de integração em desktop e mobile.
- **Figma define a identidade; estados não desenhados seguem o padrão.** **Atendido.** Estados sem frame (pendente, recusado, vazio, erro, skeleton, páginas da conta no mobile) seguem os componentes existentes. Evidência: [pedidos](orders.md#decisões-e-desvios-do-figma), [conta](account.md#decisões-e-desvios-do-figma).

## 2. Stack obrigatória

| Tecnologia      | Status       | Como e onde                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React           | **Atendido** | Toda a interface (`src/routes`, `src/components`), Strict Mode em `src/main.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| TypeScript      | **Atendido** | `tsc -b` estrito (`npm run typecheck`); contratos tipados com validadores em `src/contracts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| TanStack Router | **Atendido** | `src/app/router.tsx`: rotas tipadas, search params do catálogo, guardas `requireSession`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| TanStack Query  | **Atendido** | Consultas, mutations e cache por escopo em `src/data/*`; atualização otimista em `data/account/hooks.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Axios           | **Atendido** | Instância única `src/lib/http.ts`; todas as chamadas REST passam por ela                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| REST APIs       | **Atendido** | Contratos em [REST](contracts/rest.md), handlers em `src/mocks/handlers.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Socket.IO       | **Atendido** | `socket.io-client` em `src/realtime/catalog.ts`; servidor simulado `src/mocks/socket.ts` com `@mswjs/socket.io-binding`                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Tailwind CSS    | **Atendido** | Tailwind v4 pelo plugin `@tailwindcss/vite`, com tokens em `@theme`. Layout, espaçamento, tipografia, cores e responsividade dos componentes usam classes utilitárias nos próprios elementos, com variantes de breakpoint (`max-[701px]:`, `min-[701px]:`). `globals.css` fica com o que não se expressa bem em utilitários: seletores de descendentes e de estado, máscaras, sombras, animações e regras compartilhadas entre classes. Ver [ARCHITECTURE.md › Componentes e estilos](../ARCHITECTURE.md#componentes-e-estilos) e [verificação final](final-verification.md#tailwind) |
| shadcn/ui       | **Atendido** | `components.json`; `components/ui/button.tsx` (cva/cn) e `dialog.tsx` (Radix) adaptados à identidade; Radix Tabs no detalhe                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| MSW             | **Atendido** | `src/mocks` (REST e WebSocket), ativado por `VITE_ENABLE_MOCKS`, também no build publicado                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Playwright      | **Atendido** | `tests/e2e`, `tests/integration`, `tests/deploy`; referências visuais versionadas                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Lighthouse      | **Atendido** | `lighthouserc.cjs`, `scripts/audit-lighthouse.mjs`, relatórios em `docs/lighthouse/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

- **Tecnologias participando efetivamente; build e organização livres.** **Atendido.** Vite 8; organização em [ARCHITECTURE.md](../ARCHITECTURE.md).

## 3. Telas e fluxos

| Tela                   | Status       | Como                                                                                          | Evidência                                                                            |
| ---------------------- | ------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Início                 | **Atendido** | Destaques, catálogo paginado, busca, filtros combináveis, ordenação, modos e navegação ao NFT | [descoberta](discovery.md); `discovery.spec.ts`                                      |
| Detalhes do NFT        | **Atendido** | Galeria, abas, edição, quantidade com limite, favoritar e comprar                             | [descoberta](discovery.md); `discovery.spec.ts`, `cart.spec.ts`, `account.spec.ts` 8 |
| Carrinho de NFTs       | **Atendido** | Quantidades, remoção, cupom e resumo da API                                                   | [carrinho](cart.md); `cart.spec.ts`                                                  |
| Pagamento              | **Atendido** | Dados do colecionador, carteira e rede, revisão e envio                                       | [checkout](checkout.md); `checkout.spec.ts`                                          |
| Confirmação de pedido  | **Atendido** | Resultado, transação, itens, taxas e total, a partir do snapshot                              | [pedidos](orders.md); `orders.spec.ts` 1, 11                                         |
| Login                  | **Atendido** | Autenticação, validação e retorno ao fluxo                                                    | [sessão](session.md); `session.spec.ts`                                              |
| Cadastro               | **Atendido** | Criação, validação por campo e 409 de duplicidade                                             | [sessão](session.md); `session.spec.ts`                                              |
| Perfil do colecionador | **Atendido** | Dados, avatar e troca de senha                                                                | [conta](account.md); `account.spec.ts` 2 a 5                                         |
| Carteiras              | **Atendido** | Principal e secundária, cadastro e edição                                                     | [conta](account.md); `account.spec.ts` 6, 7                                          |

- **Frames desktop e mobile; perfil, carteiras e confirmação também no mobile.** **Atendido.** Composição mobile própria para as três telas sem frame. Evidência: [conta](account.md#rotas-e-navegação), [pedidos](orders.md#decisões-e-desvios-do-figma); projetos mobile de todas as suítes.
- **Páginas editoriais, suporte, atividade, ofertas e downloads fora; ações auxiliares coerentes, sem falso sucesso.** **Fora do escopo** (pelo próprio requisito), tratado com honestidade: diálogo de indisponibilidade ou página "Esta seção não está disponível nesta versão." Evidência: [conta](account.md#seções-não-implementadas-como-páginas), `account.spec.ts` 1, `session.spec.ts` "ações sociais e recuperação informam indisponibilidade".

### Catálogo e detalhe

- **Busca, filtros, ordenação e paginação na URL, com refresh e histórico.** **Atendido.** `lib/discovery-search.ts` é a única fonte do estado. Evidência: `discovery.spec.ts` "busca, filtros, modos, paginação e histórico…".
- **Filtros combináveis; mudança de filtro reinicia a paginação.** **Atendido** (corrigido na etapa final: o formulário enviava a página atual). Evidência: `discovery.spec.ts` "aplicar filtros a partir da página 2 volta à página 1"; [verificação final](final-verification.md).
- **Consultas refletem os parâmetros; vazio, falhas e respostas fora de ordem.** **Atendido.** Chaves completas, `AbortSignal` e cenário `out-of-order`. Evidência: `foundation.spec.ts` "out-of-order queries…", `discovery.spec.ts` "URLs inválidas… resultados vazios", "skeleton, falha e recuperação".
- **Detalhe: acesso direto, inexistente, edição indisponível e limite de quantidade.** **Atendido.** Evidência: `discovery.spec.ts` "galeria, abas, limites…" ("NFT não encontrado"), `cart.spec.ts` "mesma edição soma à linha e exceder o limite…", `deploy.spec.ts` 1.
- **Favoritos persistem para o usuário autenticado.** **Atendido.** Evidência: [conta](account.md#favoritos); `account.spec.ts` 8, 10.

### Carrinho

- **Adicionar, alterar e remover, respeitando disponibilidade por NFT e edição.** **Atendido.** Evidência: [carrinho](cart.md); `cart.spec.ts` (quantidades, limites, conflitos 409).
- **Manter após refresh e preservar itens do visitante ao autenticar.** **Atendido.** Carrinho no servidor simulado e mesclagem no login. Evidência: `cart.spec.ts` "…refresh preserva", `session.spec.ts` "mesclagem soma, acrescenta…".
- **Cupom com inválido ou expirado.** **Atendido.** Evidência: `cart.spec.ts` "cupons: válido, fixo maior que o subtotal, inexistente, expirado…".
- **Subtotal, desconto, taxa e total coerentes com a API.** **Atendido.** Evidência: [carrinho](cart.md); `cart.spec.ts` "valores preservam precisão decimal…".
- **Refletir preço e disponibilidade recebidos com o carrinho aberto.** **Atendido.** Evidência: `cart.spec.ts` "nft.updated altera preço e disponibilidade…".
- **ETH como strings decimais, precisão, quantidades inteiras, cotação como referência.** **Atendido.** `contracts/eth.ts` em `bigint`. Evidência: `eth.spec.ts`, `foundation.spec.ts` "ETH filtering…", [checkout](checkout.md).

### Pagamento e confirmação

- **Validar campos e permitir revisão.** **Atendido.** Evidência: `checkout.spec.ts` 4, 10.
- **Carteiras cadastradas, rede, conexão, recusa e desconexão simuladas.** **Atendido.** Evidência: `checkout.spec.ts` 3, 5, 6, 7.
- **Revalidar preço, disponibilidade, cupom e taxas; mudanças exigem nova confirmação.** **Atendido.** Evidência: `checkout.spec.ts` 8, 8b, 8c, 9; `orders.spec.ts` 7.
- **Impedir duplicados em cliques repetidos e reenvios após timeout.** **Atendido.** Chave de idempotência por tentativa. Evidência: `orders.spec.ts` 4, 5, 16, 17, 19, 20.
- **Pendente, confirmado e recusado, com recuperação após refresh ou reconexão.** **Atendido.** Evidência: `orders.spec.ts` 1, 3, 8, 9, 13.
- **Confirmação só para pedido confirmado na simulação.** **Atendido.** O recibo só é exibido com o estado `confirmed` vindo do servidor. Evidência: `orders.spec.ts` 1, 3, 10.
- **Preservar itens em falhas; remover só o comprado.** **Atendido.** Evidência: `orders.spec.ts` 1, 2, 3.
- **Recibo reproduz o snapshot; alterações posteriores não o modificam; referências simuladas.** **Atendido.** Evidência: `orders.spec.ts` 11; "Ver no Etherscan" informa indisponibilidade (`orders.spec.ts` 14).

### Conta e sessão

- **Cadastro, login, logout e sessão integrados; rotas privadas exigem autenticação.** **Atendido.** Evidência: [sessão](session.md); `session.spec.ts` (guardas de rota).
- **Sessão recuperável; expiração na navegação e no checkout com retomada; logout e troca de usuário limpam caches e subscriptions.** **Atendido** (reforçado na etapa final: mutations privadas vinculadas à identidade que as iniciou, tentativa de pedido preservada na expiração, eventos privados não chegam a sessões encerradas). Evidência: `session.spec.ts` "troca de usuário A → B…", "expiração durante a navegação…"; `checkout.spec.ts` 11; `account.spec.ts` 14, 15; `orders.spec.ts` 13, 19, 21.
- **Validar cadastro, perfil, senha e carteiras, inclusive erros da API; persistência após refresh; credenciais fictícias e sem senha em claro.** **Atendido.** Evidência: `account.spec.ts` 2 a 6, 16; `session.spec.ts` "nenhuma senha em claro…".

## 4. Integração e estado

- **Router nas rotas, search e proteção; Query nas consultas, mutations e cache; REST pelo Axios.** **Atendido.** Evidência: [ARCHITECTURE.md › Rotas](../ARCHITECTURE.md#rotas), [› Estratégia de cache](../ARCHITECTURE.md#estratégia-de-cache).
- **Contratos tipados entre transporte, estado e interface.** **Atendido.** `src/contracts` com validadores usados pelos handlers e pela interface.
- **Carregamento, vazio, erro, sucesso e atualização em segundo plano.** **Atendido.** Evidência: `discovery.spec.ts` "skeleton, falha e recuperação", `cart.spec.ts` "falhas preservam o estado…".
- **Invalidação coerente após mutations e eventos.** **Atendido.** Evidência: [ARCHITECTURE.md › Estratégia de cache](../ARCHITECTURE.md#estratégia-de-cache); `foundation.spec.ts` "real Socket.IO receives persisted update…".
- **Cancelamento ou descarte de respostas obsoletas.** **Atendido.** Evidência: `foundation.spec.ts` "…selection change forwards cancellation to Axios", `cart.spec.ts` "leitura antiga do carrinho nunca sobrescreve…", `session.spec.ts` "resposta tardia da sessão anterior…".
- **Isolamento por usuário e por parâmetros.** **Atendido.** Chaves `[recurso, escopo]`. Evidência: `account.spec.ts` 10, 14, 15; `session.spec.ts` "troca de usuário A → B…".
- **Recuperação de falhas sem duplicar operações.** **Atendido.** Evidência: `orders.spec.ts` 5, 19, 20.
- **Rotas inexistentes e acesso direto.** **Atendido.** Evidência: `accessibility.spec.ts` (página inexistente), `deploy.spec.ts` 1.
- **Atualização otimista com rollback; política de cache, retries e sincronização documentada.** **Atendido.** Favoritos. Evidência: `account.spec.ts` 9; [ARCHITECTURE.md › Estratégia de cache](../ARCHITECTURE.md#estratégia-de-cache).

## 5. Contratos REST

| Recurso        | Status       | Evidência                                                                                           |
| -------------- | ------------ | --------------------------------------------------------------------------------------------------- |
| Sessão e conta | **Atendido** | [REST](contracts/rest.md); `session.spec.ts`                                                        |
| NFTs           | **Atendido** | [REST](contracts/rest.md); `foundation.spec.ts`                                                     |
| Favoritos      | **Atendido** | [REST](contracts/rest.md#conta-implementada-perfil-carteiras-e-favoritos); `account.spec.ts` 8 a 12 |
| Carrinho       | **Atendido** | [carrinho](cart.md); `cart.spec.ts`                                                                 |
| Cotação        | **Atendido** | [checkout](checkout.md); `checkout.spec.ts` 7, 8                                                    |
| Pedidos        | **Atendido** | [pedidos](orders.md); `orders.spec.ts`                                                              |
| Perfil         | **Atendido** | [conta](account.md); `account.spec.ts` 2 a 5                                                        |
| Carteiras      | **Atendido** | [conta](account.md); `account.spec.ts` 6, 7; `checkout.spec.ts` 5                                   |

- **Erros de validação, sessão inválida, falta de permissão, inexistente, conflito e falha transitória.** **Atendido.** 400, 401, 403, 404, 409, 503 e falha de rede. Evidência: [REST](contracts/rest.md); `orders.spec.ts` 12 (403), `foundation.spec.ts` "one-shot and named HTTP/network failures…".
- **Idempotência: a mesma tentativa recupera o mesmo pedido; a mesma chave com outro conteúdo gera conflito.** **Atendido.** Evidência: `orders.spec.ts` 5, 6.

## 6. Mocking com MSW

- **Mocks na camada de rede, reutilizados entre desenvolvimento, demonstração e testes; nada fictício em componentes, hooks ou Axios.** **Atendido.** Evidência: [cenários](mock-scenarios.md); a ponte de testes só controla o servidor simulado.
- **Estado consistente entre os recursos; persistência e reset completos.** **Atendido.** Evidência: `foundation.spec.ts` "serialized writes persist across reload; full reset…", "reset clears scenario failures…".

### Simulating Network Conditions and Failures

- **Lentidão, latência variável, timeouts, indisponibilidade e erros HTTP, configuráveis e reproduzíveis.** **Atendido.** `mocks/scenarios.ts`. Evidência: [cenários](mock-scenarios.md); [README › Fluxos de falha](../README.md#reproduzir-os-fluxos-de-falha).
- **Fixtures com variedade, dois usuários e cenários determinísticos:**
  - sucesso e vazio — **atendido** (`foundation.spec.ts`, cenário `empty`);
  - latência variável e fora de ordem — **atendido** (`delay`, `out-of-order`);
  - falhas de conexão e 4xx/5xx — **atendido** (`failNext`, `http-error`, `network-error`);
  - sessão expirada e acesso não autorizado — **atendido** (`expireSession`, 403 do pedido);
  - conflito de cadastro ou validação — **atendido** (`session.spec.ts`, `account.spec.ts` 2);
  - cupom inválido ou expirado — **atendido** (`KURIO15`, `expireCoupon`);
  - preço alterado ou edição esgotada na compra — **atendido** (`update`, `changeBeforeNextOrder`);
  - timeout após criação com idempotência — **atendido** (`loseNextOrderResponse`);
  - pagamento confirmado e recusado — **atendido** (`setPayment`).
- **Eventos por MSW com integração Socket.IO; transporte e limitações documentados.** **Atendido.** Evidência: [eventos](contracts/events.md).
- **Cenários exercitam `socket.io-client`, sem setters ou cache direto.** **Atendido.** Evidência: `foundation.spec.ts` "real Socket.IO receives persisted update…", `liveStats()` (contadores do cliente da página).
- **Mocks por configuração, no build de demonstração; dados simulados refletidos em REST e eventos.** **Atendido.** `VITE_ENABLE_MOCKS=true` por padrão; gravação antes da emissão. Evidência: [implantação](deploy-verification.md).

## 7. Tempo real com Socket.IO

| Evento          | Status       | Evidência                                                                                                                                   |
| --------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `nft.updated`   | **Atendido** | Catálogo, detalhe, carrinho, checkout e Lista de interesse: `discovery.spec.ts`, `cart.spec.ts`, `checkout.spec.ts` 9, `account.spec.ts` 12 |
| `order.updated` | **Atendido** | `orders.spec.ts` 1, 3, 10, 21                                                                                                               |

- **Identidade estável, recurso e versão; tolerância a duplicatas e eventos antigos.** **Atendido.** Evidência: [eventos](contracts/events.md); `foundation.spec.ts` "duplicate and old events never regress…", `orders.spec.ts` 10.
- **Reconciliação REST após reconexão; eventos de sessão anterior não atualizam outro usuário; listeners liberados.** **Atendido.** Evidência: `foundation.spec.ts` "transport interruption…", "repeated connection lifecycles release listeners…"; `orders.spec.ts` 10, 21.
- **Cenário do carrinho (1 a 4): mudança durante a navegação, aviso, resumo atualizado, checkout bloqueia cotação desatualizada.** **Atendido.** Evidência: `cart.spec.ts` "nft.updated altera preço e disponibilidade; conflito bloqueia…", `checkout.spec.ts` 9.
- **Interrupção durante pedido pendente, recuperação após reconexão ou recarga sem nova compra; terminais.** **Atendido.** Evidência: `orders.spec.ts` 8, 9, 10.

## 8. Interface, responsividade e acessibilidade

- **Preservar tipografia, cores, espaçamentos, hierarquia, imagens e composição; adaptar shadcn/ui.** **Atendido**, com desvios documentados. Composição a partir dos frames; fidelidade visual revisada e aprovada pelo usuário. Evidência: [ARCHITECTURE.md › Desvios do Figma](../ARCHITECTURE.md#desvios-do-figma), referências visuais.
- **Desktop, tablet e mobile; 390, 768 e 1440 px.** **Atendido.** As três larguras são cobertas por todas as suítes de integração: projetos `*-desktop` (1440), `*-tablet` (768) e `*-mobile` (390), incluindo a acessibilidade. Composições de 768 px documentadas. Evidência: [testes](testing.md), [carrinho](cart.md#design-e-desvios-do-figma), [sessão](session.md#desvios-do-figma-e-indisponibilidades), [conta](account.md#rotas-e-navegação).
- **Skeletons com shimmer, dimensões preservadas e movimento reduzido.** **Atendido.** Evidência: `discovery.spec.ts` "skeleton…", `cart.spec.ts` "…skeleton aparece em resposta lenta", `accessibility.spec.ts` "movimento reduzido"; CLS ≤ 0,003 no Lighthouse.
- **Obrigatórios:**
  - teclado e foco visível — **atendido** (`accessibility.spec.ts` roteiro de teclado);
  - foco em diálogos e drawers — **atendido** (`session.spec.ts`, `checkout.spec.ts` 12, `account.spec.ts` 13);
  - semântica, labels e erros associados — **atendido** (axe sem violações; `aria-invalid` e `aria-describedby`);
  - alternativas textuais — **atendido** (axe);
  - contraste e estados não dependentes só de cor — **atendido**: regra `color-contrast` do axe ativa e, para texto sobre imagem, gradiente ou camadas, contraste medido nos pixels; três correções (texto do hero mobile, fundo do hero mobile, botão do cupom mobile); estados sem depender só de cor verificados (link sublinhado) ([acessibilidade](accessibility.md#contraste));
  - feedback de mutations e tempo real — **atendido** (`Notices`, regiões de status);
  - sem overflow horizontal nem perda com zoom — **atendido** (`accessibility.spec.ts` "reflow a 320 px").
- **Assets do arquivo, imagens e fontes locais; substituições documentadas.** **Atendido.** Evidência: [descoberta](discovery.md#design-recursos-e-desvios), `docs/figma-assets.json`.

## 9. Testes com Playwright

- **E2E executáveis com os mocks, cobrindo os 12 grupos.** **Atendido.** `npm test`. Mapa grupo a grupo em [testes](testing.md#mapa-dos-12-grupos):
  1. busca, filtros, ordenação, paginação e histórico — **atendido**;
  2. acesso direto e inexistente — **atendido**;
  3. cadastro, login, expiração, logout e troca de usuário — **atendido**;
  4. favoritos com falha e recuperação — **atendido**;
  5. carrinho e persistência após refresh/login — **atendido**;
  6. compra completa até o recibo — **atendido**;
  7. falha de pagamento, clique repetido e timeout — **atendido**;
  8. perfil, avatar, senha e carteiras com erros — **atendido**;
  9. preço/disponibilidade via Socket.IO no checkout — **atendido**;
  10. eventos duplicados ou antigos, desconexão e retomada — **atendido**;
  11. teclado, foco de diálogos e validação — **atendido**;
  12. skeletons, falha e nova tentativa — **atendido**.
- **Chromium desktop e mobile; regressão visual de início, detalhe, carrinho e pagamento, com baselines versionadas.** **Atendido** (e o recibo). Evidência: `tests/e2e/*-snapshots/`.
- **Estado isolado; relógio, latência e eventos controlados; relatório HTML e traces.** **Atendido.** Evidência: [testes › Isolamento e tempo](testing.md#isolamento-e-tempo), [› Relatórios e traces](testing.md#relatórios-e-traces).
- **Verificações pela interface e pelos resultados; tempo real pelo cliente Socket.IO e REST pelos handlers MSW.** **Atendido.** Evidência: [testes](testing.md#as-duas-suítes).

## 10. Performance e Lighthouse

- **Início e detalhe, mobile e desktop, build otimizado e cenário padrão.** **Atendido.** Medição oficial na URL publicada, com MSW, Socket.IO, imagens e fontes. Evidência: [desempenho](performance.md).
- **Metas.** **Atendido** na medição oficial (URL publicada): mobile 92 no início e no detalhe; desktop 100 nos dois; Accessibility, Best Practices e SEO em 100. Ressalvas:
  - a referência local fica abaixo no mobile (89 e 84), porque a latência local é baixa demais para o modelo simulado, que dá peso maior à transferência de JavaScript ([desempenho](performance.md#linha-de-base-9c93652));
  - a margem no mobile é estreita: uma das três execuções oficiais do início marcou 89 (a primeira, com o cache da CDN frio; FCP observado de 1,4 s), e medições em outras máquinas podem oscilar alguns pontos.
- **Três medições, mediana, configuração versionada, relatórios HTML/JSON, versões, ambiente e condições.** **Atendido.** Evidência: `lighthouserc.cjs`, `docs/lighthouse/`, [desempenho › Ambiente e condições](performance.md#ambiente-e-condições).
- **LCP, CLS e TBT; justificativas; sem simplificações para a auditoria.** **Atendido.** Evidência: [desempenho](performance.md) (gargalo confirmado e alavancas descartadas).
- **Como reproduzir a medição oficial:** `LIGHTHOUSE_URL=https://jungle-gaming-challenge-joao.vercel.app npm run audit:lighthouse` e `node scripts/lighthouse-medians.mjs published` ([README › Auditoria de desempenho](../README.md#auditoria-de-desempenho)).

## 11. Critérios de avaliação

| Critério                           | Status       | Evidência                                                                                                                                          |
| ---------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fidelidade visual e responsividade | **Atendido** | Fidelidade aprovada pelo usuário, com desvios documentados; 390, 768 e 1440 px nas suítes ([ARCHITECTURE.md](../ARCHITECTURE.md#desvios-do-figma)) |
| Fluxos e experiência de uso        | **Atendido** | Compra e conta completas, validações e recuperação ([testes](testing.md))                                                                          |
| Integração e estado                | **Atendido** | [ARCHITECTURE.md](../ARCHITECTURE.md#estratégia-de-cache), seção 4 acima                                                                           |
| Tempo real                         | **Atendido** | [eventos](contracts/events.md), seção 7 acima                                                                                                      |
| Mocking                            | **Atendido** | [cenários](mock-scenarios.md), seção 6 acima                                                                                                       |
| Testes                             | **Atendido** | [testes](testing.md)                                                                                                                               |
| Acessibilidade                     | **Atendido** | [acessibilidade](accessibility.md)                                                                                                                 |
| Performance                        | **Atendido** | [desempenho](performance.md)                                                                                                                       |
| Arquitetura e documentação         | **Atendido** | [ARCHITECTURE.md](../ARCHITECTURE.md), [README](../README.md), clone limpo em [verificação final](final-verification.md)                           |

Eliminatórios:

- **Uso efetivo da stack obrigatória.** **Atendido.** Evidência: seção 2.
- **Fluxos principais não apenas visuais.** **Atendido.** Todos passam pela API simulada. Evidência: `orders.spec.ts` 1, `account.spec.ts`, `cart.spec.ts`.
- **Compra confirmada só com resposta da simulação.** **Atendido.** O recibo depende do estado `confirmed` do servidor (REST ou `order.updated` validado). Evidência: `orders.spec.ts` 1, 3, 10; `deploy.spec.ts` 3 e 4.
- **Nenhuma exposição de dados entre usuários.** **Atendido.** Caches por escopo, mutations vinculadas à identidade, eventos privados só para sessões ativas do dono. Evidência: `session.spec.ts` "troca de usuário A → B…", `account.spec.ts` 10, 14, 15, `orders.spec.ts` 10, 12, 21.
- **Eventos nunca simulados diretamente na UI.** **Atendido.** Eventos saem do servidor simulado e chegam pelo `socket.io-client`. Evidência: [eventos](contracts/events.md), `foundation.spec.ts`.
- **Testes E2E executáveis.** **Atendido.** `npm test`; resultados em [verificação final](final-verification.md).

## 12. Entrega

- **Código-fonte, lockfile, assets, mocks, fixtures, testes e configurações de auditoria.** **Atendido.** `package-lock.json`, `public/assets`, `src/mocks`, `tests`, `lighthouserc.cjs`.
- **Deploy obrigatório, repositório e URL pública.** **Atendido.** https://jungle-gaming-challenge-joao.vercel.app; repositório https://github.com/Moharu/frontend-challenge. Evidência: [implantação](deploy-verification.md).
- **Versão publicada corresponde ao código, acessível na avaliação, mocks e tempo real funcionando, acesso direto e refresh.** **Atendido** (commit verificado no README). Evidência: `deploy.spec.ts` contra a URL, [implantação](deploy-verification.md).
- **README com setup, variáveis, credenciais, cenários e reset, comandos e fluxos de falha.** **Atendido.** Evidência: [README](../README.md).
- **Contratos, sessão, carrinho, cache, reconciliação, limitações, decisões de UX e desvios em `ARCHITECTURE.md`.** **Atendido.** Evidência: [ARCHITECTURE.md](../ARCHITECTURE.md).
- **Comandos de desenvolvimento com mocks, build, preview, tipos, lint, Playwright e Lighthouse.** **Atendido.** Evidência: [README](../README.md#comandos).
- **Executa a partir de checkout limpo, sem serviços privados.** **Atendido.** Evidência: [verificação final › Clone limpo](final-verification.md#clone-limpo).

## Itens parciais e fora do escopo

- **Parcial:** nenhum.
- **Fora do escopo:** páginas editoriais, suporte, atividade (histórico de pedidos), ofertas, downloads, login social e recuperação de senha.
