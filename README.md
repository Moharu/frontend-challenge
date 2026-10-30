# KURIO — Marketplace de NFTs (desafio frontend)

Marketplace de NFTs em React + TypeScript, fiel ao Figma em desktop e mobile, cobrindo **descoberta → carrinho → login → checkout → pedido → conta**, com atualizações em tempo real via Socket.IO. Não há backend: REST, persistência e Socket.IO são simulados na camada de rede com MSW, inclusive na versão publicada.

| | |
|---|---|
| **Demo publicada** | https://jungle-gaming-challenge-joao.vercel.app (commit verificado `b7be43c`) |
| **Requisitos originais** | [`docs/challenge-requirements.md`](docs/challenge-requirements.md) |
| **Requisito → código → teste** | [`docs/requirements-traceability.md`](docs/requirements-traceability.md) |
| **Arquitetura e desvios do Figma** | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| **Verificação final** | [`docs/final-verification.md`](docs/final-verification.md) |

> Toda a documentação está em pt-BR.

---

## Avaliando em 5 minutos

Sem instalar nada, na demo publicada:

1. **Descoberta** — busque, filtre por coleção/rede/preço e ordene. Copie a URL e abra em outra aba: o estado é o mesmo (a URL é a única fonte de verdade; mudar filtros volta à página 1).
2. **Carrinho como visitante** — no detalhe do NFT, **Comprar** adiciona o item e abre o carrinho (não há botão "Adicionar ao carrinho" separado; desvio registrado em [`docs/cart.md`](docs/cart.md)). Aplique `KURIO10` (10%), `LANCAMENTO` (−0,1 ETH) ou `KURIO15` (expirado → mensagem de erro).
3. **Login** — entre com `ada@example.test` / `AdaKurio2026`. O carrinho de visitante é mesclado ao da conta sem perder quantidades.
4. **Checkout** — escolha uma carteira (conexão simulada) e confirme. Você vai para `/orders/<id>`; o pagamento aprova em ~1,5 s e o recibo aparece na mesma página via evento `order.updated`, sem reload.
5. **Conta** — edite perfil, avatar, senha e carteiras; favoritos são otimistas.
6. **Responsividade** — repita em 390, 768 e 1440 px.

Fluxos de falha (pagamento recusado, timeout, sessão expirada, preço mudando no checkout, queda do socket) exigem o **build de integração** — veja [Reproduzindo falhas](#reproduzindo-falhas).

Para recomeçar do zero: DevTools → Application → **Clear site data** e recarregue. Cada navegador tem sua própria simulação.

### Dados de demonstração

Contas fictícias (a seed guarda apenas sal + hash PBKDF2):

| E-mail | Senha | Carteiras |
|---|---|---|
| `ada@example.test` | `AdaKurio2026` | "Principal" (Ethereum, MetaMask) e "Reserva" (Polygon, Coinbase Wallet, `nova.kurio.eth`) |
| `lin@example.test` | `LinKurio2026` | Nenhuma — para cadastrar uma durante o checkout |

| Cupom | Efeito |
|---|---|
| `KURIO10` | 10% sobre o subtotal |
| `LANCAMENTO` | 0,1 ETH, limitado ao subtotal |
| `KURIO15` | Expirado |

---

## Como rodar localmente

Requisitos: **Node 24** (`.nvmrc` → 24.22.0) e **npm 11**. Nenhum serviço externo.

```bash
git clone https://github.com/Moharu/frontend-challenge.git
cd frontend-challenge
nvm use
npm ci
cp .env.example .env.local
npx playwright install chromium   # Linux sem libs: --with-deps
npm run dev:mocks                 # http://localhost:5173
```

### Variáveis de ambiente

| Variável | Padrão | Uso |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` | Base do REST e do Socket.IO |
| `VITE_ENABLE_MOCKS` | `true` | `true`/`false` exatos. Desligar exige uma API real compatível — não há dados de fallback |
| `VITE_ENABLE_TEST_HARNESS` | só no modo `integration` | Expõe `window.__KURIO_TEST__`. **Nunca** usar na demo pública |

Todo `VITE_*` vai para o bundle: nada de segredos.

### Comandos

| Comando | O que faz |
|---|---|
| `npm run dev:mocks` | Desenvolvimento com mocks |
| `npm run build` / `npm run preview` | Build otimizado (inclui typecheck) / preview |
| `npm run typecheck` · `lint` · `format:check` | Tipos (app, config, testes) · ESLint com zero warnings · Prettier |
| **`npm test`** | Tudo, em ordem: build normal → E2E → build de integração → integração |
| `npm run test:e2e` | E2E + regressão visual no build normal |
| `npm run test:integration` | 12 grupos de fluxos, falhas, tempo real e a11y (axe) |
| `npm run test:a11y` | Só acessibilidade |
| `npm run test:e2e:report` / `test:integration:report` | Relatórios HTML com traces |
| `DEPLOY_URL=… npm run test:deploy` | Smoke test de um build publicado |
| `npm run audit:lighthouse` | Lighthouse, 3 execuções por página e perfil |

**Por que duas suítes?** Os testes de integração precisam de controles do servidor simulado (falhas, latência, pagamento, eventos) que só existem no build de integração. O E2E roda no build normal e garante que esses controles **não** vazam para produção.

Playwright usa 2 workers por padrão (paralelismo ilimitado derrubava o Chromium no WSL). Com memória de sobra: `PW_WORKERS=4 npm test`.

---

## Estado da entrega

Última verificação completa ([`docs/final-verification.md`](docs/final-verification.md)):

| Verificação | Resultado |
|---|---|
| Typecheck, lint, formatação, builds | ✅ |
| E2E (inclui baselines visuais de home, detalhe, carrinho e checkout) | 14 passaram |
| Integração (desktop, tablet 768 px e mobile) | 304 passaram, 10 pulados por design (testes de perfil único) |
| Deploy smoke (`b7be43c`) | 10 passaram |
| Clone limpo (`npm ci` → `npm test`) | ✅ |

**Lighthouse na URL publicada** (mediana de 3 execuções, início e detalhe):

| Perfil | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| Mobile | 92 / 92 | 100 | 100 | 100 |
| Desktop | 100 / 100 | 100 | 100 | 100 |
| **Meta** | ≥ 90 | ≥ 95 | ≥ 95 | ≥ 90 |

Relatórios oficiais em [`docs/lighthouse/`](docs/lighthouse/). A performance mobile fica perto do limite e cai abaixo de 90 na referência local ([`docs/performance.md`](docs/performance.md)).

### Cobertura por critério de avaliação

| Critério (peso) | Onde ver |
|---|---|
| Fidelidade visual e responsividade (20) | Baselines Playwright; integração em 390/768/1440; desvios em [`ARCHITECTURE.md` → Desvios do Figma](ARCHITECTURE.md) |
| Fluxos e UX (20) | [`discovery`](docs/discovery.md) · [`cart`](docs/cart.md) · [`session`](docs/session.md) · [`checkout`](docs/checkout.md) · [`orders`](docs/orders.md) · [`account`](docs/account.md) |
| Integração e estado (15) | [`docs/contracts/rest.md`](docs/contracts/rest.md); chaves de query e política de cache em `ARCHITECTURE.md` |
| Tempo real (10) | [`docs/contracts/events.md`](docs/contracts/events.md); reconciliação REST × Socket.IO em `ARCHITECTURE.md` |
| Mocking (10) | [`docs/mock-scenarios.md`](docs/mock-scenarios.md); `src/mocks/` |
| Testes (10) | [`docs/testing.md`](docs/testing.md) |
| Acessibilidade (5) | [`docs/accessibility.md`](docs/accessibility.md) |
| Performance (5) | [`docs/performance.md`](docs/performance.md) |
| Arquitetura e docs (5) | [`ARCHITECTURE.md`](ARCHITECTURE.md) |

---

## Decisões que valem a leitura

Resumo; o detalhe está em [`ARCHITECTURE.md`](ARCHITECTURE.md).

- **A API é a fonte da verdade.** Subtotal, desconto, taxa e total vêm do servidor; a UI só exibe. Valores monetários trafegam como string decimal e a aritmética usa `bigint` em 10⁻¹⁸ ETH.
- **Eventos nunca são a única fonte.** A cada conexão/reconexão do socket, os recursos ativos (detalhes, listas, carrinho, pedido) são relidos via REST. Eventos são deduplicados por `eventId` + versão e nunca regridem um estado mais novo.
- **Pedidos idempotentes.** `Idempotency-Key`: mesma chave e corpo devolvem o mesmo pedido; corpo diferente → 409. "Tentar novamente" após timeout recupera o pedido já criado.
- **Checkout bloqueia preço velho.** A cotação é revalidada ao confirmar; mudança de valor exige nova confirmação (`409 QUOTE_CHANGED`).
- **Isolamento por usuário.** Dados privados usam chaves `[recurso, escopo]` com usuário e geração. Logout/troca de conta cancela requisições, limpa caches de outros escopos e solta ouvintes privados do socket. `order.updated` só chega ao dono e revalida a sessão a cada entrega.
- **Sessão expirada não perde trabalho.** O 401 abre o login e retorna ao mesmo lugar, preservando rascunho do checkout e tentativa de pedido pendente.
- **Pedido é página, não modal** — sobrevive a refresh, tem link direto e retoma após login.
- **Sem retry automático.** Erros mostram "Tentar novamente"; `keepPreviousData` evita telas piscando.
- **Nada de falso sucesso.** Ações fora do escopo mostram aviso de indisponibilidade.

---

## Reproduzindo falhas

```bash
npm run build:integration
npm run preview -- --outDir dist-integration --port 4178
```

Abra http://localhost:4178 e use o console (`__KURIO_TEST__.reset()` volta à seed):

| Cenário | Comando antes da ação |
|---|---|
| Catálogo vazio / erro / ordem trocada | `scenario("empty" \| "http-error" \| "network-error" \| "out-of-order")` |
| Pagamento recusado | `setPayment({ status: "declined", reason: "Saldo insuficiente." })` |
| Timeout após criar pedido | `loseNextOrderResponse()` → confirme → "Tentar novamente" devolve o mesmo pedido |
| Sessão expirada | `expireSession()` e faça qualquer ação privada |
| Preço/estoque muda no checkout | `update("nft-001", "edition-1-limited", { priceEth: "2.5" })` ou `{ available: 0 }`; `changeBeforeNextOrder(…)` muda logo antes do envio |
| Queda do socket | `interrupt()` → `restore()` (reconcilia via REST) |
| Falha HTTP/rede pontual | `failNext("http" \| "network")`, `failNextCart`, `failNextCheckout`, `failNextFavorite` |
| Latência | `delay("emerald", 2000)`, `cartDelay("read", 2000)`, `checkoutDelay("quote", 2000)`, `favoriteDelay(1500)` |
| Carteira recusa conexão | `rejectNextConnection()` |
| Cupom expira com carrinho aberto | `expireCoupon("KURIO10")` |

Lista completa em [`docs/mock-scenarios.md`](docs/mock-scenarios.md).

---

## Limitações e trade-offs conhecidos

Declarados de propósito, para não serem descobertos na revisão:

- **Token de sessão no `localStorage`.** Simplificação da simulação; em produção seria cookie `HttpOnly` + `Secure` + `SameSite`.
- **Rede de pagamento independente da rede do NFT.** Uma integração real rejeitaria, filtraria carteiras ou dividiria o pedido.
- **"Comprar" não reserva estoque** — só a criação do pedido reserva (liberada se recusado).
- **Entre abas**: adota o snapshot mais recente por contador lógico, sem notificação ativa.
- **Escape em diálogos aninhados**: se pressionado antes do aviso terminar de abrir, fecha os dois.
- **Sem passada manual com leitor de tela** — nomes, marcos e regiões de status foram verificados com axe e testes.
- **Performance mobile no limite** (92 publicado, abaixo de 90 localmente).
- **Ícones de provedores, ilustração "THANK YOU" e ícones da conta** foram redesenhados porque não vieram na exportação do Figma.
- **14 de 144 classes migradas para Tailwind** não apareceram nos estados capturados na comparação visual; estão cobertas só por testes funcionais.
- Requisições `/api` disparadas no instante de um reload completo saem do service worker e recebem 404 na Vercel (sem efeito na página nova).

---

## Deploy

Vercel, a partir de `main` (Vite, `npm ci` / `npm run build` / `dist`, Node 24.x). Nenhuma variável de ambiente configurada. Tudo que não é arquivo nem `/api/*` reescreve para `index.html`; `/api/*` é atendido pelo service worker no navegador. A UI só inicia com o MSW ativo — sem service worker, a página explica o porquê. Cache: `no-cache` em HTML e `mockServiceWorker.js`, `immutable` em arquivos com hash. Detalhes em [`docs/deploy-verification.md`](docs/deploy-verification.md).

---

## Uso de IA

O projeto foi construído com Claude Code (e Codex no início), com Figma MCP para referências de design. O [`docs/ai-interaction-journal.md`](docs/ai-interaction-journal.md) registra pedidos, decisões e — principalmente — onde a saída da IA foi **contestada**:

- MSW 3 sugerido pelo npm conflitava com a integração Socket.IO → fixado MSW 2.15.0 em vez de forçar peer deps.
- Exemplo do README da lib de integração não batia com as exportações reais → validado no código-fonte.
- Deduplicação de eventos ignorava versões diferentes entre detalhe e listas → corrigido com teste de regressão.
- Uma revisão independente final encontrou 6 defeitos (ex.: mutations da conta enviadas como o próximo usuário após troca de sessão; filtros que não resetavam a paginação) — todos corrigidos com teste de regressão.

Nenhum commit foi feito sem aprovação explícita, e o diário separa verificação automatizada de revisão humana.

---

## Mapa da documentação

- **Arquitetura:** [`ARCHITECTURE.md`](ARCHITECTURE.md)
- **Contratos:** [`rest`](docs/contracts/rest.md) · [`events`](docs/contracts/events.md) · [`mock-scenarios`](docs/mock-scenarios.md)
- **Áreas:** [`discovery`](docs/discovery.md) · [`cart`](docs/cart.md) · [`session`](docs/session.md) · [`checkout`](docs/checkout.md) · [`orders`](docs/orders.md) · [`account`](docs/account.md)
- **Qualidade:** [`testing`](docs/testing.md) · [`accessibility`](docs/accessibility.md) · [`performance`](docs/performance.md) · [`final-verification`](docs/final-verification.md) · [`requirements-traceability`](docs/requirements-traceability.md)
- **Registros por etapa** (históricos): `docs/*-verification.md`, [`docs/handoffs/`](docs/handoffs/)
- **Assets do Figma:** [`docs/figma-assets.json`](docs/figma-assets.json)
