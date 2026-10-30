# Verificação da implantação

Etapa guiada por `docs/handoffs/coding-agent-deploy-draft-pt-br.md`, com autorização do usuário para criar o projeto `jungle-gaming-challenge-joao` e implantar, e para o commit e o push da preparação.

- **URL de produção:** https://jungle-gaming-challenge-joao.vercel.app
- **Commit publicado:** primeira implantação `c757b34`; verificada por último `56365d3` (`56365d3b9d4b771a1a9e3dcde448b7a28b0832b4`), branch `main`
- **Implantações:** primeira `dpl_phKy3itJdCiBsfuRyMjoH3BsS5xG` (criada pelo conector, build de cerca de 26 s); verificada por último `dpl_7pNttnhA25to6uWZwC9SDAb5n9yM` (criada pelo push), região `iad1`, estado READY. Este registro chega por um commit só de documentação e testes, que gera mais uma implantação com o mesmo código da aplicação.
- **Data:** 2026-10-30
- **Projeto:** conta pessoal (`joaovtelos-projects`), vinculado ao repositório `Moharu/frontend-challenge`; cada push em `main` implanta em produção

## Configuração aplicada na Vercel

| Item                  | Valor                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework             | Vite                                                                                                                                              |
| Instalação            | `npm ci`                                                                                                                                          |
| Build                 | `npm run build`                                                                                                                                   |
| Saída                 | `dist`                                                                                                                                            |
| Node                  | 24.x (fixado no projeto; o padrão do projeto novo era 26.x; `engines.node` também pede 24)                                                        |
| Variáveis de ambiente | nenhuma                                                                                                                                           |
| Proteção              | padrão da conta ("Vercel Authentication" nas URLs de implantação e prévias); o domínio de produção `*.vercel.app` é público, confirmado sem login |

Pelo conector da Vercel: a primeira tentativa de criar o projeto falhou por falta de acesso ao escopo da conta (403); o usuário aprovou o acesso. A segunda chamada criou o projeto, mas respondeu com um formato inesperado; o projeto foi conferido antes de qualquer nova escrita, as configurações foram fixadas e a implantação de produção foi criada a partir do GitHub, no commit acima.

## Preparação (Parte 1)

- Instalação limpa (`npm ci`) e build a partir de um clone novo do GitHub: aprovados; `dist/` contém `index.html`, `assets/`, `mockServiceWorker.js` e `robots.txt`.
- O build publicado não tem a ponte de testes nem as rotas `/__private` e `/__protocol` (verificado pela suíte de implantação).
- Tipos, lint (com `check:bom`), formatação, build normal e de integração aprovados; 184 testes de integração aprovados e 2 ignorados; 14 E2E aprovados (com o novo teste sem service worker); `npm run test:deploy` contra `vite preview`: 8 aprovados e 2 pulados (cabeçalhos e `/api`, que dependem do `vercel.json`).

## Cabeçalhos observados em produção

| Caminho                                  | Status | Content-Type                                 | Cache-Control                         |
| ---------------------------------------- | ------ | -------------------------------------------- | ------------------------------------- |
| `/`, `/nfts/nft-001`, `/account/wallets` | 200    | `text/html; charset=utf-8`                   | `no-cache`                            |
| `/rota-que-nao-existe`                   | 200    | `text/html` (página "não encontrada" da SPA) | `no-cache`                            |
| `/mockServiceWorker.js`                  | 200    | `application/javascript; charset=utf-8`      | `no-cache`                            |
| `/robots.txt`                            | 200    | `text/plain`                                 | `no-cache`                            |
| `/assets/index-IgI-wyOR.js` (com hash)   | 200    | `application/javascript`                     | `public, max-age=31536000, immutable` |
| `/api/qualquer`                          | 404    | `text/plain` ("The page could not be found") | `no-cache`                            |

`X-Content-Type-Options: nosniff` e `Referrer-Policy: strict-origin-when-cross-origin` presentes nas respostas conferidas.

## `npm run test:deploy` contra a URL de produção

Chromium desktop e mobile, 2 workers.

- **Primeira execução** (logo após a implantação, cache da CDN frio): 8 aprovados e 2 falhas no desktop.
  - "acesso direto e refresh": uma requisição `/api/nfts` foi respondida pela rede (404) em vez do service worker.
  - "arquivos estáticos": a fonte ainda não tinha carregado quando o teste a procurou (problema do teste).

### Requisições `/api` fora do service worker: investigação

- **Primeira hipótese:** numa primeira visita, o MSW anunciaria estar pronto antes de o worker controlar a página. Correção defensiva (`d06407d`): esperar um controlador antes de renderizar.
- **Segunda hipótese:** o worker do MSW 2.15 se desregistra quando a última página descarrega, e a página seguinte continuaria controlada pelo worker antigo. Correção (`56365d3`): esperar que a página seja controlada pelo worker ativo do registro atual (`navigator.serviceWorker.ready` comparado com `navigator.serviceWorker.controller`), por no máximo 3 s.
- **Ocorrências seguiram raras** (1 em 50 e 2 em 50 rodadas), sempre no mobile ou desktop logo antes de um `goto` ou `reload` do teste, e com a URL da página ainda sendo a anterior ou a nova.
- **Causa confirmada:** o cliente do MSW envia `CLIENT_CLOSED` no `beforeunload`, e o worker esquece a página na hora; requisições que essa página ainda faz ou conclui depois disso vão para a rede. Para confirmar, a verificação passou a registrar o horário de cada navegação e de cada requisição desviada: nas rodadas seguintes, **todas** as requisições desviadas ocorreram imediatamente antes do início de uma navegação da página principal. Elas pertencem ao documento que está sendo descartado; o resultado nunca é usado, e a página nova carrega os próprios dados. **Não afeta o usuário.**
- **Verificação ajustada:** uma requisição `/api` fora do worker (e o 404 que o console registra) só é aceita se uma navegação começar até 2 s depois dela; qualquer outra continua reprovando o teste, e as aceitas são listadas no relatório.
- **As duas correções em `main.tsx` permanecem** como precaução para a primeira visita (não houve como provar que eram necessárias); a integração (184), o E2E (14) e a verificação local seguiram aprovados com elas.

### Resultado final

Implantação de `56365d3`, criada automaticamente pelo push: `npm run test:deploy` com 8 repetições, **80/80 aprovados**, sem erro no console; duas requisições desviadas, ambas no instante de uma navegação (aceitas e listadas). A compra chega ao recibo confirmado sem recarga (evento `order.updated` pelo Socket.IO simulado) e os favoritos aparecem na Lista de interesse. O teste de arquivos estáticos passou a esperar fontes e artes carregarem.

## Etapa final

- **`229ba64`:** implantação de produção `dpl_8txDDMhn3wdTYfJPZBhpj1sw3Xod`, READY. `npm run test:deploy` com 10 aprovados.
- **`b7be43c`** (correção do controle deslizante): implantação de produção `dpl_Gp7KNVYYkQ51vpYyormTn3ALfYo8`, criada pelo push, READY. `npm run test:deploy` com **10 aprovados**. Produção conferida na Vercel servindo esse commit.
- O registro desses resultados chega num commit só de documentação, que gera mais uma implantação com o mesmo código da aplicação.

## Diferenças em relação ao build local

- Cabeçalhos e o 404 de `/api/*` só existem na Vercel (`vite preview` não aplica o `vercel.json`).
- As requisições desviadas na saída de uma página só aparecem na Vercel: localmente `/api/*` recebe o `index.html` do `vite preview` com status 200, e a resposta muito rápida faz o caso ser raro.

## Implantação automática

Confirmada: os pushes de `d06407d` e `56365d3` em `main` geraram implantações de produção (origem `git`) sem ação no painel, e a URL de produção passou a servir cada uma.

## Erros de infraestrutura

Nenhum ("Target crashed", navegador fechado, timeout, falta de memória ou processo encerrado). Não ficaram navegadores do Playwright nem `vite preview` órfãos.

## Não verificado

- Navegadores além do Chromium e dispositivos físicos.
- Lighthouse: ver [desempenho](performance.md).
