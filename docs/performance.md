# Desempenho

Etapa guiada por `docs/handoffs/coding-agent-performance-draft-pt-br.md`. Metas da seção 10 de `docs/challenge-requirements.md`: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95 e SEO ≥ 90, em início (`/`) e detalhe (`/nfts/nft-001`), mobile e desktop.

## Ambiente e condições

| Item       | Valor                                                                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Lighthouse | 12.6.1, por `@lhci/cli` 0.15.1                                                                                                           |
| Navegador  | Chromium do Playwright, HeadlessChrome 156, `--headless --no-sandbox`                                                                    |
| Node / npm | 24.22.0 / 11.19.1                                                                                                                        |
| Máquina    | WSL2 (kernel 6.18.54.1) em Windows 11, Intel i7-12700K, 15 GB de memória; `benchmarkIndex` ≈ 3077                                        |
| Mobile     | perfil padrão do Lighthouse: throttling **simulado** (RTT 150 ms, 1,6 Mbps, CPU 4×)                                                      |
| Desktop    | `--collect.settings.preset=desktop`                                                                                                      |
| Execuções  | três por página e perfil; mediana por categoria e de LCP, CLS e TBT                                                                      |
| Oficial    | URL publicada, https://jungle-gaming-challenge-joao.vercel.app                                                                           |
| Referência | build local servido por `scripts/serve-dist.mjs`: compressão Brotli/gzip, reescrita da SPA e cabeçalhos do `vercel.json`, como na Vercel |

O `vite preview` não comprime nada: o chunk do MSW chega com 172 KB em vez de 108 KB, e as métricas mobile simuladas pioram (início 84 e detalhe 78 no commit `9c93652`, contra 89 e 83 com o servidor comprimido). Por isso a referência local passou a usar o servidor próprio.

Comandos em "Auditoria de desempenho" no [README](../README.md#auditoria-de-desempenho).

## Linha de base (`9c93652`)

| Alvo      | Perfil  | Página  | Perf | A11y |  BP | SEO |     LCP |   CLS |   TBT |
| --------- | ------- | ------- | ---: | ---: | --: | --: | ------: | ----: | ----: |
| Publicado | mobile  | início  |   92 |  100 | 100 | 100 | 2755 ms | 0,003 |  1 ms |
| Publicado | mobile  | detalhe |   92 |  100 | 100 | 100 | 2830 ms | 0,000 | 28 ms |
| Publicado | desktop | início  |  100 |  100 | 100 | 100 |  612 ms | 0,002 |  0 ms |
| Publicado | desktop | detalhe |  100 |  100 | 100 | 100 |  577 ms | 0,001 |  0 ms |
| Local     | mobile  | início  |   89 |  100 | 100 | 100 | 3015 ms | 0,003 | 57 ms |
| Local     | mobile  | detalhe |   83 |  100 | 100 | 100 | 3793 ms | 0,000 | 59 ms |
| Local     | desktop | início  |   99 |  100 | 100 | 100 |  776 ms | 0,002 |  0 ms |
| Local     | desktop | detalhe |   99 |  100 | 100 | 100 |  864 ms | 0,001 |  0 ms |

A URL publicada já atingia todas as metas antes desta etapa. O local fica abaixo no mobile porque a latência do servidor local é baixa demais para o modelo simulado (TTFB observado de cerca de 5 ms), que então dá peso relativo maior à transferência de JavaScript.

## Resultado final (URL publicada, `5a5b433`)

Implantação criada pelo push de `5a5b433`, conferida pelo nome do bundle servido antes de medir. Data: 2026-10-30.

| Perfil  | Página  | Perf | A11y |  BP | SEO |     LCP |   CLS |   TBT |
| ------- | ------- | ---: | ---: | --: | --: | ------: | ----: | ----: |
| mobile  | início  |   92 |  100 | 100 | 100 | 2755 ms | 0,001 |  0 ms |
| mobile  | detalhe |   92 |  100 | 100 | 100 | 2842 ms | 0,000 | 32 ms |
| desktop | início  |  100 |  100 | 100 | 100 |  614 ms | 0,002 |  0 ms |
| desktop | detalhe |  100 |  100 | 100 | 100 |  583 ms | 0,001 |  0 ms |

Todas as metas atingidas. Os relatórios HTML e JSON das três execuções por página e perfil estão em [`docs/lighthouse/`](lighthouse/) (cerca de 17 MB, quase tudo capturas de tela embutidas pelo Lighthouse). Local final (`5a5b433`, servidor comprimido): mobile 89 no início e 84 no detalhe, desktop 99 nos dois, demais categorias 100.

`npm run test:deploy` contra a URL publicada: 10 aprovados, sem erro no console. Uma requisição `/api` fora do worker foi aceita e listada, no instante de uma navegação (caso documentado em `docs/deploy-verification.md`). Contra o build local: 8 aprovados e 2 pulados.

## Gargalo confirmado

Pelos relatórios (rede observada e decomposição do LCP):

- **Início (mobile):** o LCP é o `section.hero` (fundo `mobile-home-MaskGroup.svg`), estático. A decomposição mostra quase todo o tempo em _render delay_ (1,7 s publicado), e FCP ≈ LCP: nada pinta antes de o JavaScript rodar e de o MSW estar ativo.
- **Detalhe (mobile):** o LCP é a arte do NFT; o tempo fica em _load delay_ (1,7 s), porque a URL da arte vem da API, que depende da mesma cadeia mais o `GET /api/nfts/nft-001`.
- **O que domina a métrica simulada** é o volume de JavaScript de alta prioridade requisitado antes da pintura observada: 291 KB (Brotli) no publicado, dos quais 108 KB do chunk do MSW. Os tempos **observados** sem throttling ficam entre 0,35 e 0,6 s em todos os casos.
- **Espera pelo controle do service worker:** medida em cinco visitas limpas ao site publicado, com um script que registra `serviceWorker.ready` e `controllerchange`. O `controllerchange` chega no mesmo milissegundo de `ready` (espera de 0 a 1 ms), pelo `clients.claim()` do worker. A espera de até 3 s de `controlledByActiveWorker` só se prolonga quando o worker antigo se desregistra numa recarga, o caso que ela cobre. Fica como está.

## Mudanças aplicadas e efeito medido

Medidas na referência local comprimida (medianas de três execuções).

| Mudança                                                                                         | Efeito                                                                                       |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Temporizador de pagamentos só com pedido pendente, armado para o vencimento mais próximo        | TBT mobile do início 57 → 40 ms; escores iguais (89 e 84); sem releitura periódica do estado |
| Auditoria por URL (`LIGHTHOUSE_URL`), relatórios separados por alvo e servidor local comprimido | medição reproduzível e comparável com a Vercel                                               |

Antes, `src/mocks/browser.ts` rodava `resolveDue` a cada 250 ms em todas as páginas, inclusive para visitantes, relendo e interpretando todo o estado do `localStorage`. Agora o temporizador é armado na inicialização (quando há pedido pendente de uma visita anterior) e na criação de um pedido, e desarmado quando não resta nenhum. A resolução ao iniciar e em cada acesso ao pedido continua, então uma recarga não perde nenhuma.

## Alavancas avaliadas e descartadas

| Alavanca                                                                                              | Resultado medido                                       | Motivo                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Renderizar antes de o MSW estar pronto, com as requisições do Axios e o socket aguardando a prontidão | mobile: início 89 → 84, detalhe 83 → 85; desktop igual | O chunk do MSW continua requisitado antes da pintura observada e entra no grafo simulado do LCP; o hero pinta mais cedo de verdade, mas o modelo não credita. Perda líquida no início                                                                        |
| O mesmo, sem `modulepreload` do MSW e carregando-o depois do primeiro quadro                          | mobile: início 89 → 83, detalhe 83 → 85                | O chunk passa a ser descoberto só depois do bundle principal: a cadeia fica sequencial e mais longa                                                                                                                                                          |
| `fetchpriority="high"` nos `preload` dos fundos do hero                                               | início 84 → 84                                         | Sem ganho                                                                                                                                                                                                                                                    |
| Nomes com hash para `/assets/art`, `/assets/figma` e `/assets/fonts` (cache `immutable`)              | não aplicável ao Lighthouse, que mede visita limpa     | As fontes já têm hash (vêm do `@fontsource` pelo Vite e são servidas de `/assets/`). Artes e ícones são referenciados por URL no CSS e nos dados; renomear exigiria reescrever essas referências sem ganho nas métricas exigidas. A regra de uma semana fica |

## Verificações sem mudança

- **Compressão na Vercel:** Brotli no HTML, nos bundles e nos SVGs, com os caches do `vercel.json`.
- **Fontes:** Roboto Mono local, subconjunto `latin` (inclui os acentos do pt-BR), `font-display: swap`, `preload` dos pesos 400 e 700 usados acima da dobra; o peso 500, usado por uma regra, carrega só quando necessário.
- **Imagens:** quatro variantes por arte (240, 480, 800 e 1254 px). A arte do hero e a do detalhe têm `fetchpriority="high"` e carregam sem `loading="lazy"`; o `lazy` fica só nos cartões e no "Diário da Cunhagem", abaixo do hero.
- **JavaScript:** nenhum código de testes (`__KURIO_TEST__`, `installHarness`) no build normal; conta, checkout, pedidos e autenticação já são chunks separados das rotas públicas.
- **`/api/nfts` duas vezes no início:** a segunda é a reconciliação ao conectar o Socket.IO (invalida as listas ativas), por projeto; acontece depois do LCP.

## Erros de infraestrutura

Nenhum ("Target crashed", navegador fechado, timeout, falta de memória ou processo encerrado). Ocorrências do próprio processo de medição:

- Um servidor local (`serve-dist`) ficou órfão uma vez, porque o script encerrava o subshell, e não o Node. Foi encerrado e o script passou a usar `exec`.
- Os perfis temporários do Chromium no WSL continuam sendo removidos pelo `scripts/audit-lighthouse.mjs`.

Ao final, sem navegadores, servidores de pré-visualização ou perfis temporários órfãos.
