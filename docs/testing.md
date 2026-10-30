# Testes

Todos os testes usam Playwright com Chromium, contra builds otimizados servidos localmente, com os mocks MSW e o cliente `socket.io-client` reais.

## Comando único

```sh
npx playwright install chromium   # uma vez
npm test                          # = npm run test:all
```

`npm test` roda, nesta ordem: `npm run build` (tipos e build normal), `npm run test:e2e`, `npm run build:integration` e `npm run test:integration`. Cada suíte sobe o próprio servidor de pré-visualização.

## As duas suítes

| Suíte       | Build                               | Comando                            | O que cobre                                                                                                                                                 |
| ----------- | ----------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E2E         | normal (`dist/`), o mesmo publicado | `npm run test:e2e`                 | Inicialização sem erros e sem a ponte de testes, mensagem sem service worker e regressão visual de início, detalhe, carrinho, pagamento e recibo            |
| Integração  | `dist-integration/`, com a ponte    | `npm run test:integration`         | Os 12 grupos da seção 9: fluxos, falhas, tempo real, sessão, conta, teclado e acessibilidade (axe), em desktop (1440 px), tablet (768 px) e mobile (390 px) |
| Implantação | URL publicada ou build local        | `DEPLOY_URL=… npm run test:deploy` | Fumaça do site publicado, só com comportamento público ([implantação](deploy-verification.md))                                                              |

**Por que a ponte só existe no build de integração.** Os cenários de falha e tempo (pagamento recusado, resposta perdida, latência, falhas de uso único, expiração de sessão, eventos duplicados ou antigos, interrupção do socket) precisam de controles do servidor simulado. Eles ficam em `window.__KURIO_TEST__` (`src/testing/harness.ts`), incluídos só quando `VITE_ENABLE_TEST_HARNESS=true` (modo `integration`). O build normal e o publicado não têm a ponte, e o E2E verifica essa ausência. Os testes acionam os cenários pela ponte, mas observam a interface e as respostas reais: REST passa pelos handlers MSW, e tempo real pelo cliente Socket.IO da página.

## Relatórios e traces

| Suíte      | Relatório HTML                                                      | Traces e capturas das falhas |
| ---------- | ------------------------------------------------------------------- | ---------------------------- |
| E2E        | `playwright-report/e2e` (`npm run test:e2e:report`)                 | `test-results/e2e`           |
| Integração | `playwright-report/integration` (`npm run test:integration:report`) | `test-results/integration`   |

Os dois configs usam `trace: "retain-on-failure"` e `screenshot: "only-on-failure"`. Um trace abre no relatório HTML (anexo do teste) ou com `npx playwright show-trace <arquivo>.zip`. Os diretórios são ignorados pelo Git.

## Isolamento e tempo

- **Estado isolado:** cada teste usa um contexto novo do navegador, ou seja, localStorage, sessionStorage e service worker próprios, e a simulação parte da seed. Nenhum teste depende de outro.
- **Relógio e latência:** o pagamento é retido (`setPayment(…, 3600000)`) e resolvido pelo teste (`resolvePayments()`); latências e falhas são configuradas por chamada (`delay`, `favoriteDelay`, `profileDelay`, `cartDelay`, `checkoutDelay`, `failNext…`); a validade da cotação é ajustável (`quoteTtl`). As referências visuais fixam relógio, fontes e imagens.
- **Eventos:** disparados pelo servidor simulado (`update`, `duplicate`, `older`, `duplicateOrder`, `staleOrder`), nunca injetados na interface.
- **Sem esperas fixas:** as verificações de "nada mudou" esperam um sinal determinístico: os contadores do cliente Socket.IO da página (`liveStats()`), os contadores de requisições do simulador (`state().requests`) ou dois quadros de animação depois de uma resposta.
- **Workers:** 2 por padrão (`PW_WORKERS=n` para mais), por causa de quedas do Chromium ("Target crashed") sob WSL com paralelismo sem limite.

## Mapa dos 12 grupos

Arquivos em `tests/integration/` (integração) e `tests/e2e/` (E2E). Os testes de integração rodam em desktop (1440 px), tablet (768 px, projetos `*-tablet`, com o layout acima do ponto de quebra de 700 px) e mobile (390 px), salvo indicação; os E2E, em desktop e mobile.

| Grupo (seção 9)                                                             | Testes                                                                                                                                                                                                                                                                                                                                     | Comando                                                            |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| 1. Busca, filtros combinados, ordenação, paginação e histórico              | `discovery.spec.ts`: "busca, filtros, modos, paginação e histórico são baseados na URL", "URLs inválidas são normalizadas…", "aplicar filtros a partir da página 2 volta à página 1", "drawer mobile aplica, cancela e limpa…"; `foundation.spec.ts`: "REST filtering, stable sorting, pagination…", "out-of-order queries stay isolated…" | `npm run test:integration -- discovery.spec.ts foundation.spec.ts` |
| 2. Acesso direto ao detalhe e recurso inexistente                           | `discovery.spec.ts`: "galeria, abas, limites e links relacionados funcionam no detalhe" (inclui "NFT não encontrado"); `foundation.spec.ts`: "detail, invalid query errors…"; `deploy.spec.ts`: acesso direto e refresh                                                                                                                    | `npm run test:integration -- discovery.spec.ts`                    |
| 3. Cadastro, login, expiração, logout e troca de usuário                    | `session.spec.ts`: cadastro, login, refresh, logout, "troca de usuário A → B nunca exibe dados de A", expiração durante a navegação, guardas de rota, resposta tardia da sessão anterior; `checkout.spec.ts` 11; `account.spec.ts` 10, 14 e 15; `orders.spec.ts` 13, 19 e 21                                                               | `npm run test:integration -- session.spec.ts`                      |
| 4. Favoritos, falha de mutation e recuperação                               | `account.spec.ts`: 8 (favoritos e Lista de interesse), 9 (reversão otimista em falha HTTP e de rede, cliques rápidos), 11 (deslogado), 12, 14 (troca de usuário com a fila)                                                                                                                                                                | `npm run test:integration -- account.spec.ts`                      |
| 5. Carrinho, quantidades, remoção, cupom e persistência após refresh/login  | `cart.spec.ts` (adicionar, badge, limites, remoção, refresh, cupons, precisão, contexto novo, leitura antiga); `session.spec.ts`: "mesclagem soma, acrescenta, marca conflito…"                                                                                                                                                            | `npm run test:integration -- cart.spec.ts`                         |
| 6. Compra completa, do catálogo ao recibo                                   | `orders.spec.ts` 1; `checkout.spec.ts` 1; `accessibility.spec.ts`: roteiro de teclado (desktop); `e2e/order.spec.ts` (referência visual do recibo); `deploy.spec.ts` 3 e 4                                                                                                                                                                 | `npm run test:integration -- orders.spec.ts`                       |
| 7. Falha de pagamento, clique repetido e timeout                            | `orders.spec.ts`: 3 (recusa), 4 (cliques repetidos e duas abas), 5 (resposta perdida), 6 (mesma chave, outro corpo), 8 (refresh durante o envio), 16, 17, 19 (expiração na nova tentativa), 20 (sem `sessionStorage`)                                                                                                                      | `npm run test:integration -- orders.spec.ts`                       |
| 8. Perfil, avatar, senha e carteiras, com erros                             | `account.spec.ts`: 2 a 7, 15 e 16; `checkout.spec.ts` 5 (cadastro de carteira no checkout)                                                                                                                                                                                                                                                 | `npm run test:integration -- account.spec.ts`                      |
| 9. Preço/disponibilidade via Socket.IO no checkout                          | `checkout.spec.ts`: 9 ("nft.updated durante o checkout gera aviso e nova cotação"), 8, 8b, 8c; `cart.spec.ts`: "nft.updated altera preço e disponibilidade; conflito bloqueia…"                                                                                                                                                            | `npm run test:integration -- checkout.spec.ts`                     |
| 10. Eventos duplicados ou antigos, desconexão e retomada do pedido pendente | `orders.spec.ts`: 9 (socket desconectado), 10 (duplicado, antigo, de outro usuário), 13, 21 (sessões encerradas); `foundation.spec.ts`: duplicados e antigos, interrupção e reconexão, ciclos de conexão; `cart.spec.ts`: reconexão; `discovery.spec.ts`: "preço, disponibilidade, duplicatas e reconexão"                                 | `npm run test:integration -- orders.spec.ts foundation.spec.ts`    |
| 11. Teclado, foco de diálogos e validação                                   | `accessibility.spec.ts` (roteiro de teclado, axe, reflow); `session.spec.ts`: "teclado e foco no login…", validação do cadastro; `checkout.spec.ts` 4 e 12; `cart.spec.ts`: "teclado mantém o foco…"; `account.spec.ts` 13; `orders.spec.ts` 14                                                                                            | `npm run test:a11y`                                                |
| 12. Skeletons, falha e nova tentativa                                       | `discovery.spec.ts`: "skeleton, falha e recuperação passam pelos handlers reais"; `cart.spec.ts`: "falhas preservam o estado, permitem nova tentativa e o skeleton aparece em resposta lenta"; `session.spec.ts`: falha transitória na verificação; `foundation.spec.ts`: falhas HTTP e de rede                                            | `npm run test:integration -- discovery.spec.ts cart.spec.ts`       |

Regressão visual (seção 9): `tests/e2e/discovery.spec.ts` (início e detalhe), `cart.spec.ts`, `checkout.spec.ts` (pagamento) e `order.spec.ts` (recibo), em desktop e mobile, com referências versionadas em `tests/e2e/*-snapshots/`. Uma referência só é atualizada (`npm run test:e2e -- --update-snapshots`) depois de inspecionar a diferença.

Um teste isolado: `npm run test:integration -- orders.spec.ts -g "resposta perdida"`.
