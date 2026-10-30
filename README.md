# Desafio frontend KURIO

Marketplace de NFTs em React e TypeScript: descoberta (catálogo com busca, filtros, ordenação e paginação na URL, detalhe com galeria e edições), carrinho persistido com cupons e resumo calculado pela API, cadastro, login e sessão com mesclagem do carrinho de visitante, checkout com carteiras e conexão simulada, pedidos idempotentes com pagamento simulado e recibo, conta do colecionador (perfil, avatar, senha, carteiras principal e secundária, favoritos otimistas) e tempo real por Socket.IO (`nft.updated`, `order.updated`). REST, persistência e Socket.IO são simulados na camada de rede com MSW, também na versão publicada.

**Demonstração publicada:** https://jungle-gaming-challenge-joao.vercel.app (commit verificado `cc99ff5`). Repositório: https://github.com/Moharu/frontend-challenge.

Requisitos originais em [docs/challenge-requirements.md](docs/challenge-requirements.md), preservados sem alterações, e o atendimento de cada um, lado a lado, em [rastreabilidade](docs/requirements-traceability.md).

## Setup a partir de um clone limpo

Requisitos: **Node 24** (`.nvmrc`: 24.22.0; `engines`: `>=24.22.0 <25`) e **npm 11**. Nenhum serviço externo ou backend é necessário.

```sh
git clone https://github.com/Moharu/frontend-challenge.git
cd frontend-challenge
nvm use              # ou instale o Node 24.22.0
npm ci
cp .env.example .env.local
npx playwright install chromium
npm run dev:mocks    # http://localhost:5173
```

No Windows, copie `.env.example` pelo terminal ou editor. No Linux, se faltarem bibliotecas de sistema do navegador, use `npx playwright install --with-deps chromium` com as permissões necessárias.

## Variáveis de ambiente

| Variável                   | Padrão                   | Uso                                                                                                                                                                               |
| -------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL`        | `/api`                   | Base das chamadas REST e do Socket.IO                                                                                                                                             |
| `VITE_ENABLE_MOCKS`        | `true`                   | Aceita exatamente `true` ou `false`. Sem backend real, a demonstração depende dos mocks; desabilitá-los exige uma API compatível (não há dados fictícios alternativos no cliente) |
| `VITE_ENABLE_TEST_HARNESS` | só no modo `integration` | Inclui a ponte de testes (`window.__KURIO_TEST__`). Nunca usar na demonstração pública                                                                                            |

`.env.local` e variáveis do processo sobrescrevem os padrões do modo. Todos os `VITE_*` são públicos e entram no build; nunca inclua segredos.

## Comandos

| Comando                                                       | Finalidade                                                                                             |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `npm run dev` / `npm run dev:mocks`                           | Desenvolvimento / desenvolvimento com mocks explicitamente habilitados                                 |
| `npm run build` / `npm run preview`                           | Tipos e build otimizado / pré-visualização local do build                                              |
| `npm run typecheck`                                           | Tipos da aplicação, configuração e testes                                                              |
| `npm run lint`                                                | ESLint sem avisos e `check:bom` (falha com arquivo iniciado por BOM UTF-8)                             |
| `npm run format` / `npm run format:check`                     | Formatar / verificar a formatação                                                                      |
| **`npm test`**                                                | **Todos os testes, na ordem certa:** build normal, E2E, build de integração e integração               |
| `npm run test:e2e`                                            | E2E no build normal: inicialização sem a ponte e regressão visual (exige `npm run build`)              |
| `npm run build:integration` / `npm run test:integration`      | Build com a ponte em `dist-integration` / os fluxos dos 12 grupos, falhas, tempo real e acessibilidade |
| `npm run test:a11y`                                           | Só a acessibilidade (axe, teclado, reflow e movimento reduzido), depois de `npm run build:integration` |
| `npm run test:e2e:report` / `npm run test:integration:report` | Relatório HTML de cada suíte, com os traces das falhas                                                 |
| `DEPLOY_URL=… npm run test:deploy`                            | Fumaça de um build publicado ([implantação](#implantação))                                             |
| `npm run audit:lighthouse`                                    | Lighthouse, três execuções por página e perfil ([auditoria](#auditoria-de-desempenho))                 |

**Por que duas suítes:** a integração precisa de controles do servidor simulado (falhas, latência, pagamento, eventos), que só existem no build de integração; o build normal, que é o publicado, não os tem, e o E2E confirma isso. `npm run test:e2e` sozinho roda só esse recorte; os fluxos estão em `npm run test:integration`. Mapa dos 12 grupos, relatórios, traces e isolamento em [testes](docs/testing.md).

As configurações do Playwright usam **2 workers** por padrão: com Chromium em paralelo sem limite, o navegador caiu ("Target crashed") sob WSL. Com folga de memória, use `PW_WORKERS=4 npm test`. Referências visuais são versionadas e só devem ser atualizadas depois de inspecionadas.

## Dados de demonstração

Contas fictícias (sem valor fora desta simulação; a seed guarda só sal e hash PBKDF2):

| Conta         | E-mail             | Senha          | Carteiras                                                                                 |
| ------------- | ------------------ | -------------- | ----------------------------------------------------------------------------------------- |
| `ada_example` | `ada@example.test` | `AdaKurio2026` | "Principal" (Ethereum, MetaMask) e "Reserva" (Polygon, Coinbase Wallet, `nova.kurio.eth`) |
| `lin_example` | `lin@example.test` | `LinKurio2026` | nenhuma (para cadastrar uma no checkout)                                                  |

Cupons:

| Código       | Efeito                                  |
| ------------ | --------------------------------------- |
| `KURIO10`    | 10% de desconto no subtotal             |
| `LANCAMENTO` | 0.1 ETH de desconto, até o subtotal     |
| `KURIO15`    | Expirado (demonstra a mensagem de erro) |

Pedidos: "Confirmar compra" cria o pedido e abre `/orders/<id>`; o pagamento simulado é aprovado em cerca de 1,5 s, o carrinho perde só o que foi comprado e o recibo aparece na mesma página, pelo `order.updated`. A conexão de carteira é simulada (não usa extensão do navegador).

## Cenários: seleção e reset

**Reset na demonstração (local ou publicada):** cada navegador tem a própria simulação. Para voltar à seed, use "Limpar dados do site" (ou, nas ferramentas do desenvolvedor, Application → Clear site data) e recarregue; o service worker volta sozinho. Chaves usadas: no localStorage, `kurio.mock.catalog.v1` (estado simulado), `kurio.session.v1` e `kurio.visitor.v1`; no sessionStorage, `kurio.checkout.draft.v1:<usuário>` e `kurio.checkout.order.v1:<usuário>` e, só nos testes, `kurio.mock.quote-ttl`, `kurio.mock.payment` e `kurio.mock.session-failures`.

**Seleção de cenários (build de integração):**

```sh
npm run build:integration
npm run preview -- --outDir dist-integration --port 4178
```

Abra http://localhost:4178 e use o console do navegador:

| Chamada                            | Efeito                                                                                   |
| ---------------------------------- | ---------------------------------------------------------------------------------------- |
| `__KURIO_TEST__.scenario("empty")` | Catálogo vazio; também `"http-error"`, `"network-error"`, `"out-of-order"` e `"default"` |
| `__KURIO_TEST__.reset()`           | Restaura a seed e limpa cenários, falhas, atrasos e histórico de eventos                 |

Lista completa dos controles em [cenários de mocks](docs/mock-scenarios.md).

## Reproduzir os fluxos de falha

Localmente, no build de integração acima (chamadas no console antes da ação):

| Fluxo                                        | Como                                                                                                                                                                                           |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pagamento recusado                           | `__KURIO_TEST__.setPayment({ status: "declined", reason: "Saldo insuficiente." })` e confirme a compra                                                                                         |
| Timeout depois da criação do pedido          | `__KURIO_TEST__.loseNextOrderResponse()`, confirme e use "Tentar novamente": volta o mesmo pedido                                                                                              |
| Expiração de sessão                          | Entre, chame `__KURIO_TEST__.expireSession()` e faça qualquer ação privada (aviso, login e retorno)                                                                                            |
| Preço ou disponibilidade mudando no checkout | `__KURIO_TEST__.update("nft-001", "edition-1-limited", { priceEth: "2.5" })` com o checkout aberto; `{ available: 0 }` para esgotar; `changeBeforeNextOrder(…)` para mudar logo antes do envio |
| Desconexão do socket                         | `__KURIO_TEST__.interrupt()` e depois `__KURIO_TEST__.restore()`: a reconexão reconcilia por REST                                                                                              |
| Falha HTTP ou de rede                        | `__KURIO_TEST__.failNext("http")` ou `failNext("network")` antes da próxima requisição; também `failNextCart`, `failNextCheckout` e `failNextFavorite`                                         |
| Latência                                     | `__KURIO_TEST__.delay("emerald", 2000)` (busca "emerald"), `cartDelay("read", 2000)`, `checkoutDelay("quote", 2000)`, `favoriteDelay(1500)`                                                    |
| Conexão de carteira recusada                 | `__KURIO_TEST__.rejectNextConnection()` antes de escolher a carteira                                                                                                                           |
| Cupom expirado                               | `KURIO15` no carrinho, ou `__KURIO_TEST__.expireCoupon("KURIO10")` com o cupom aplicado                                                                                                        |

**No site publicado** não há ponte: dá para reproduzir cupom inválido ou expirado (`KURIO15`), login inválido, cadastro com e-mail ou username já usados, erros de validação, carteiras acima do limite e o reset pelos dados do site. Recusa de pagamento, timeout, expiração, eventos e falhas de rede exigem o build de integração.

## Implantação

A demonstração é publicada na Vercel a partir da branch `main`: cada push gera uma implantação de produção. Configuração (tudo vem do `vercel.json` e do `package.json`):

| Item                       | Valor                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------- |
| Framework                  | Vite                                                                                  |
| Instalação / build / saída | `npm ci` / `npm run build` / `dist`                                                   |
| Node                       | 24.x, por `engines.node`                                                              |
| Variáveis de ambiente      | nenhuma; valem os padrões de `.env.example`. Nunca definir `VITE_ENABLE_TEST_HARNESS` |

**Roteamento:** arquivos existentes têm prioridade; todo o resto, exceto `/api/*`, é reescrito para o `index.html` (acesso direto e refresh em todas as rotas). `/api/*` é atendido pelo service worker no navegador; fora dele, a plataforma responde 404. **Cabeçalhos:** `no-cache` no HTML e no `mockServiceWorker.js`, `immutable` por um ano nos arquivos com hash, uma semana em `/assets/art`, `/assets/figma` e `/assets/fonts`, `nosniff` e `Referrer-Policy`. **Service worker:** a interface só inicia com o MSW ativo; sem service worker, a página explica que a demonstração depende dele.

**Verificação:** `DEPLOY_URL=https://jungle-gaming-challenge-joao.vercel.app npm run test:deploy` (Chromium desktop e mobile, só comportamento público). Contra um build local (`npm run build`, `node scripts/serve-dist.mjs 4173` e `DEPLOY_URL=http://127.0.0.1:4173`), os testes de cabeçalhos e de `/api` são pulados. Resultados em [implantação](docs/deploy-verification.md).

## Auditoria de desempenho

A medição oficial é a da URL publicada; a local serve de referência reproduzível. Três execuções de início e detalhe nos perfis mobile e desktop:

```sh
LIGHTHOUSE_URL=https://jungle-gaming-challenge-joao.vercel.app npm run audit:lighthouse
node scripts/lighthouse-medians.mjs published
npm run build && npm run audit:lighthouse
node scripts/lighthouse-medians.mjs local
```

Os relatórios ficam em `reports/lighthouse/<published|local>/<perfil>` (ignorado pelo Git); os oficiais da entrega estão em `docs/lighthouse/`. A medição local usa `scripts/serve-dist.mjs`, que serve `dist/` com a compressão e os cabeçalhos da Vercel. Resultados, ambiente e análise em [desempenho](docs/performance.md).

## Documentação

- [ARCHITECTURE.md](ARCHITECTURE.md): contratos, sessão, carrinho, cache, reconciliação REST e Socket.IO, decisões de UX, desvios do Figma e limitações.
- [Rastreabilidade dos requisitos](docs/requirements-traceability.md): cada requisito, com status e evidência.
- [Testes](docs/testing.md), [acessibilidade](docs/accessibility.md), [desempenho](docs/performance.md) e [verificação final](docs/final-verification.md).
- Contratos: [REST](docs/contracts/rest.md) e [eventos](docs/contracts/events.md); [cenários de mocks](docs/mock-scenarios.md).
- Por área: [descoberta](docs/discovery.md), [carrinho](docs/cart.md), [sessão](docs/session.md), [checkout](docs/checkout.md), [pedidos](docs/orders.md) e [conta](docs/account.md).
- Verificações das etapas: [descoberta](docs/discovery-verification.md), [carrinho](docs/cart-verification.md), [sessão](docs/session-verification.md), [checkout](docs/checkout-verification.md), [pedidos](docs/orders-verification.md), [conta](docs/account-verification.md) e [implantação](docs/deploy-verification.md).
- Assets do Figma: `docs/figma-assets.json`. Diário do trabalho com IA: [diário](docs/ai-interaction-journal.md). Orientações das etapas: `docs/handoffs/`.

Toda a documentação é mantida em pt-BR.
