# Verificação do carrinho

Evidências executadas em 2026-10-29 sobre a árvore de trabalho da etapa do carrinho (sem commit), partindo de `63dbad2`. Ambiente: WSL2, Node 24.22.0, npm 11.19.1, Chromium headless do Playwright, Lighthouse 12.6.1.

## Verificações automatizadas

| Comando                     | Resultado                                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`         | aprovado                                                                                                    |
| `npm run lint`              | aprovado                                                                                                    |
| `npm run format:check`      | aprovado                                                                                                    |
| `npm run build`             | aprovado                                                                                                    |
| `npm run build:integration` | aprovado                                                                                                    |
| `npm run test:integration`  | 52 aprovados: 4 de aritmética ETH, 14 de protocolo, 12 de descoberta e 22 do carrinho (11 × desktop/mobile) |
| `npm run test:e2e`          | 8 aprovados: carga sem erros/sem ponte (agora com carrinho e checkout indisponível) e 6 referências visuais |

Os testes do carrinho (`tests/integration/cart.spec.ts`, desktop 1440 e mobile 390) observam a interface e passam pelos handlers MSW e pelo cliente Socket.IO reais:

1. Detalhe → adicionar → badge (vazio sem badge, quantidade exata no nome) → `/cart` com a linha correta; "Comprar NFT" adiciona e navega.
2. Badge `99+` com 100 itens.
3. Mesma edição soma à linha; exceder o limite explica o máximo restante e não altera o carrinho.
4. Quantidade: mínimo 1, máximo efetivo, totais da API, refresh e acesso direto; remover até o estado vazio com foco na próxima linha e no estado vazio.
5. Cupons inexistente, `KURIO15` expirado, `KURIO10`, troca por `LANCAMENTO`, desconto fixo maior que o subtotal (via `nft.updated`) e remoção.
6. Precisão: 0.1 + 0.2 = `0.30 ETH`; `1.000000000000000001 × 3` = `3.000000000000000003 ETH`; sem overflow horizontal.
7. `nft.updated`: mudança de preço com aviso e reconhecimento, queda de limite com ajuste, esgotamento bloqueando a finalização, eventos duplicado/antigo sem regressão, anúncio acessível.
8. Reconexão reconcilia o carrinho por REST.
9. Falha HTTP e de rede em mutation preserva o estado e permite nova tentativa; skeleton em leitura lenta; falha de carga com "Tentar novamente".
10. Teclado: foco permanece no botão de quantidade até o limite, remoção move o foco, diálogo de "Conectar e finalizar" fecha com Escape e devolve o foco.
11. Novo contexto do navegador começa com carrinho vazio.

`tests/integration/eth.spec.ts` roda em Node (sem navegador) sobre o mesmo módulo usado por handlers e interface: soma 0.1 + 0.2, 18 casas, piso zero, quantidade máxima, valores enormes, arredondamento para baixo do desconto e formatação.

## Referências visuais

Novas referências `tests/e2e/cart.spec.ts-snapshots/carrinho-{desktop,mobile}-linux.png`, com três linhas fixas e relógio estável, inspecionadas e comparadas às capturas dos frames `11:1278` e `16:360` fornecidas pelo usuário. As referências do detalhe foram regeneradas porque os botões de compra agora são ações reais e há uma linha reservada para o feedback; a diferença foi inspecionada antes da aceitação. Limitação conhecida: em capturas de página inteira, o resumo fixo do mobile aparece sobre o carrossel, como já ocorria com a navegação inferior.

Capturas de viewport verificadas pelo agente em 390, 414, 768 e 1440px. Em 768px a tabela desktop é usada com o resumo abaixo (decisão em [carrinho](cart.md)).

## Lighthouse e pré-carregamento do MSW

Rotas `/` e `/nfts/nft-001`, três execuções por rota e perfil; medianas via `node scripts/lighthouse-medians.mjs`. Relatórios em `reports/lighthouse/{mobile,desktop}`; a medição anterior ao pré-carregamento ficou em `reports/lighthouse.before-preload/` (ambos ignorados pelo Git).

| Perfil / rota           | Descoberta (etapa anterior) | Antes do pré-carregamento | Depois do pré-carregamento | LCP antes → depois | CLS   | TBT depois |
| ----------------------- | --------------------------- | ------------------------- | -------------------------- | ------------------ | ----- | ---------- |
| mobile `/`              | 89                          | 88                        | **88**                     | 3369 → 3156 ms     | 0.001 | 0 ms       |
| mobile `/nfts/nft-001`  | 85                          | 84                        | **83**                     | 3890 → 3803 ms     | 0.000 | 46 ms      |
| desktop `/`             | 99                          | 98                        | 99                         | 1034 → 981 ms      | 0.001 | 0 ms       |
| desktop `/nfts/nft-001` | 99                          | 99                        | 99                         | 884 → 850 ms       | 0.001 | 0 ms       |

Acessibilidade, boas práticas e SEO: 100 em todas as rotas e perfis. **Desempenho mobile continua abaixo da meta de 90.**

O plugin `kurio-preload-mocks` (`vite.config.ts`) adiciona `modulepreload` do chunk do MSW e de suas importações ao `index.html` quando o build tem mocks habilitados (o build com mocks desabilitados não recebe os links). O LCP mobile caiu ~90–210 ms, mas a pontuação ficou dentro da oscilação entre execuções. O restante da cadeia crítica permanece: registro/ativação do service worker do MSW, chunk da rota, `GET /api/nfts/...` e só então a imagem. Sem backend real, o MSW continua no caminho crítico; reduzir isso exigiria renderizar antes de os mocks estarem prontos, o que contraria a decisão de iniciar a interface somente com a API simulada disponível. A pequena queda em relação à descoberta (1–2 pontos) está dentro da variação observada e coincide com o código do carrinho no cabeçalho.

## Não verificado

- Comparação direta com o arquivo Figma (sem acesso pela integração nesta etapa; usadas capturas e SVGs fornecidos pelo usuário).
- Leitores de tela reais, zoom de 200% e teclado virtual em dispositivo físico.
- Duas abas gravando ao mesmo tempo no mesmo `tick` (limitação documentada).

## Correções da revisão de `480dbc7`

Rodada guiada por `docs/handoffs/coding-agent-cart-fixes-draft-pt-br.md`, sem mudanças visuais nem de carregamento (Lighthouse não repetido, conforme o handoff).

1. **Leitura antiga sobrescrevendo alteração mais nova.** No servidor simulado, `cart(token)` passou a usar a mesma fila serializada das escritas. No cliente, `keepNewestCart` é a regra única aplicada às leituras (`structuralSharing` da consulta) e às respostas de mutation (`storeCart`): versão menor do mesmo `id` é descartada, versão igual e outro `id` substituem. O atraso de leitura do carrinho nos cenários passou a modelar latência de resposta (o estado é lido antes da espera), o que torna o cenário reproduzível. Novo teste "leitura antiga do carrinho nunca sobrescreve uma alteração mais nova": `+` com escrita atrasada em 300ms, `nft.updated` real disparando um `GET` que lê o estado anterior e responde após 900ms; um `MutationObserver` registra as quantidades exibidas e verifica que, depois de 3, nunca volta a 2. Com a regra do cliente desativada temporariamente, o teste falhou (quantidade 2), confirmando que reproduz o problema; com a regra, 5 repetições por viewport passaram.
2. **`ARCHITECTURE.md` desatualizado.** Reescrito por inteiro: rotas atuais, esquema 3, endpoints de visitante/carrinho/cupom implementados, fila única de leitura/escrita, política de múltiplas abas, regra de versão no cache, o que continua somente contrato e limitações (incluindo rede de pagamento independente da rede do NFT). `docs/mock-scenarios.md` (esquema, abas, estado do carrinho, semântica do atraso de leitura), `docs/contracts/rest.md` (regra de `fields`) e `docs/cart.md` foram alinhados.
3. **`fields.quantity` com número.** As respostas 409 de `addItem`/`changeItem` trazem mensagens ("É possível adicionar no máximo 0.", "A quantidade máxima atual é 5.", "Edição esgotada."). Nenhum campo estruturado novo foi adicionado ao envelope: a interface não interpreta essa informação (exibe `message` e usa `maxQuantity` da linha do carrinho). Novo teste verifica as duas respostas 409.

Resultados: tipos, lint, formatação, build normal e de integração aprovados; 56 testes de integração (eram 52; +2 casos × desktop/mobile) e 8 E2E aprovados, sem mudança nas referências visuais.

## Ajustes finos da revisão de `fec94b1`

Rodada guiada por `docs/handoffs/coding-agent-cart-nits-draft-pt-br.md`, sem mudanças visuais nem de contrato.

1. **Limite já atingido:** com restante zero, `addItem` responde "Você já atingiu o limite desta edição no carrinho." em `fields.quantity` e "Você já tem N no carrinho e o limite atual é M. Não é possível adicionar mais unidades desta edição." na mensagem principal; com restante positivo, as mensagens anteriores foram mantidas. O teste de 409 cobre os dois casos.
2. **`pause` sem `this`:** a espera abortável virou função local de `createScenarios`, usada por `before()` e exposta como `pause`; comportamento e assinatura inalterados.
3. **Sem espera fixa no teste de versão:** a ponte de testes ganhou o diagnóstico `cartQuery()` (`dataUpdateCount` e `fetchStatus` da consulta do carrinho; ausente do build normal). O teste espera as duas atualizações (resposta do `PATCH` e `GET` atrasado) e a consulta ociosa antes da verificação final; o `MutationObserver` continua comprovando que a quantidade não regride.

Durante a verificação, o caso "falhas preservam o estado..." falhou uma vez sob carga paralela: a falha de uso único podia ser consumida pela busca do cabeçalho antes de a página montar. O trecho de falha de carga passou a usar o cenário persistente `http-error` (desligado antes de "Tentar novamente"), eliminando a dependência de tempo.

Resultados: tipos, lint, formatação e build de integração aprovados; 56 testes de integração aprovados em duas execuções completas; os casos alterados passaram em 6 a 10 repetições por viewport. Lighthouse e E2E visuais não executados nesta rodada, conforme o handoff. Outros dois testes de tempo real ainda usam esperas curtas de 300ms para comprovar ausência de efeito (fora do escopo desta rodada).
