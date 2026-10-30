# Verificação da descoberta pública

> **Registro histórico** desta etapa, verdadeiro quando escrito; não descreve o estado atual. Estado atual: [README](../README.md), [verificação final](final-verification.md), [desempenho](performance.md) e [rastreabilidade](requirements-traceability.md).

Evidências executadas em 2026-10-29 sobre a árvore de trabalho da etapa de descoberta (sem commit), partindo de `ba9a562`.

## Ambiente

- WSL2 (Linux 6.18), Node 24.22.0, npm 11.19.1.
- Chromium headless 156 do Playwright, usado também pelo Lighthouse 12.6.1 via `@lhci/cli`.
- Build otimizado com mocks habilitados (`npm run build`, servido por `vite preview`).
- Perfil mobile: padrão do Lighthouse (4G lento simulado: RTT 150 ms, ~1,6 Mbps, CPU 4×). Perfil desktop: `preset=desktop`.

## Verificações automatizadas

| Comando                     | Resultado                                                                                 |
| --------------------------- | ----------------------------------------------------------------------------------------- |
| `npm run typecheck`         | aprovado                                                                                  |
| `npm run lint`              | aprovado                                                                                  |
| `npm run format:check`      | aprovado                                                                                  |
| `npm run build`             | aprovado                                                                                  |
| `npm run build:integration` | aprovado                                                                                  |
| `npm run test:integration`  | 26 aprovados (14 de protocolo + 6 de descoberta em desktop e mobile)                      |
| `npm run test:e2e`          | 6 aprovados (carga sem erros/sem ponte de testes e 4 referências visuais, desktop/mobile) |

## Lighthouse

Rotas `/` e `/nfts/nft-001`, três execuções por rota e perfil; valores são medianas. Relatórios HTML/JSON em `reports/lighthouse/{mobile,desktop}` (ignorados pelo Git).

| Perfil  | Rota            | Desempenho | Acessibilidade | Boas práticas | SEO | LCP     | CLS   | TBT   |
| ------- | --------------- | ---------- | -------------- | ------------- | --- | ------- | ----- | ----- |
| mobile  | `/`             | **89**     | 100            | 100           | 100 | 3329 ms | 0.001 | 68 ms |
| mobile  | `/nfts/nft-001` | **85**     | 100            | 100           | 100 | 3875 ms | 0.000 | 36 ms |
| desktop | `/`             | 99         | 100            | 100           | 100 | 989 ms  | 0.001 | 0 ms  |
| desktop | `/nfts/nft-001` | 99         | 100            | 100           | 100 | 878 ms  | 0.001 | 0 ms  |

Metas: desempenho ≥90, acessibilidade ≥95, boas práticas ≥95, SEO ≥90. **O desempenho mobile fica abaixo da meta nas duas rotas**; todas as demais metas foram atingidas.

### Causas do desempenho mobile

Histórico das medianas de desempenho mobile (início / detalhe):

| Estado                                      | Início | Detalhe | LCP início | LCP detalhe |
| ------------------------------------------- | ------ | ------- | ---------- | ----------- |
| Retomada, artes PNG originais               | 85     | 86      | 3863 ms    | 3750 ms     |
| + `preload` do fundo do hero                | 88     | 86      | 3345 ms    | 3764 ms     |
| + artes WebP responsivas (`srcset`/`sizes`) | 89     | 85      | 3329 ms    | 3875 ms     |

- A causa dominante é a cadeia de requisições antes da primeira renderização: HTML → bundle principal (~151 KB) → chunk do MSW (~161 KB) e registro do service worker → chunk da rota → `GET /api/nfts/nft-001` → imagem. Sem backend real, o MSW faz parte do caminho crítico. No detalhe mobile, 73% do LCP (~2,8 s) é atraso até a descoberta da imagem; o download da arte caiu de ~1 s para ~170 ms com o WebP.
- As artes PNG de ~2 MB não eram o gargalo principal do LCP simulado, ao contrário do que esta análise indicou antes da troca. A otimização foi mantida por reduzir a transferência real (miniaturas de ~6–8 KB, arte principal de ~46 KB em 800px), especialmente em redes móveis.
- A variação de 85–86 no detalhe está dentro da oscilação entre execuções.
- Alavanca restante, não aplicada: iniciar o download do chunk do MSW em paralelo ao bundle principal (por exemplo, `modulepreload` gerado no build), encurtando a cadeia crítica. Nenhuma funcionalidade ou asset foi removido para melhorar a pontuação.

### Artes responsivas

`scripts/optimize-artwork.mjs` gera derivados WebP (qualidade 0,82; larguras 240, 480, 800 e 1254) das quatro artes distintas a partir dos PNG do Figma, usando o codificador de canvas do Chromium do Playwright, sem dependência nova. Os originais em `public/assets/figma/` permanecem versionados e inalterados; os derivados ficam em `public/assets/art/`. `artImage()` em `src/components/discovery/assets.ts` fornece `src`/`srcSet`/`sizes` para cada uso. Para regenerar: `node scripts/optimize-artwork.mjs`.

Efeito colateral corrigido: com `sizes`, a largura intrínseca da imagem de promoção passou de 1254px para 280px, o que alterava a largura mínima automática do item flex e reduzia a imagem em ~1,3px. `flex-shrink: 0` em `.promotions img` fixa os 48% do layout independentemente da imagem carregada. As quatro referências visuais foram regeneradas após a troca; os diffs inspecionados se limitavam a pixels dispersos dentro das artes (compressão), sem mudança de layout, texto ou SVG.

### Execução sob WSL

O `chrome-launcher` detecta WSL e monta um diretório temporário com caminho Windows (`C:\Users\…\lighthouse.*`), que o Chromium Linux interpreta como caminho relativo ao repositório e não remove. `scripts/audit-lighthouse.mjs` remove esses perfis temporários ao fim de cada perfil de auditoria.

## Referências visuais

As quatro referências em `tests/e2e/discovery.spec.ts-snapshots/` foram inspecionadas e correspondem à composição dos frames (cabeçalho, hero, filtros, grade, promoções, prévias editoriais, rodapé; detalhe com miniaturas, edição/quantidade, abas e relacionados).

Limitação conhecida: as capturas são de página inteira, e o Playwright desenha elementos `position: fixed` na posição da viewport. Por isso, a navegação inferior (início mobile) e a barra de compra (detalhe mobile) aparecem no meio da captura, sobre cartões e o texto de disponibilidade. Não é defeito de layout na rolagem real, mas reduz o que essas referências protegem.

## Não verificado

- Comparação lado a lado com os frames Figma nesta retomada (o Figma não foi consultado novamente).
- Leitores de tela reais, zoom de 200% e teclado virtual em dispositivo físico.
- Tablet de 768px e 414px fora dos testes automatizados.
