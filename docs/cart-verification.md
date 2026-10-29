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
