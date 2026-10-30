# Verificação da implantação

Etapa guiada por `docs/handoffs/coding-agent-deploy-draft-pt-br.md`, com autorização do usuário para criar o projeto `jungle-gaming-challenge-joao` e implantar, e para o commit e o push da preparação.

- **URL de produção:** https://jungle-gaming-challenge-joao.vercel.app
- **Commit publicado:** `c757b34` (`c757b342c2bbc2e7abc24ba980efbbc075539a92`), branch `main`
- **Implantação:** `dpl_phKy3itJdCiBsfuRyMjoH3BsS5xG`, região `iad1`, build de cerca de 26 s, estado READY
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
  - "acesso direto e refresh": uma requisição `/api/nfts` da página inicial foi respondida pela rede (404) em vez do service worker. **Não se repetiu** em 34 execuções seguintes do mesmo teste (4 isoladas e 3 rodadas completas), nem em 6 sondagens com visitas novas e recargas. Hipótese: numa primeira visita, a promessa de início do MSW resolveu antes de o worker novo assumir o controle da página. Primeira correção (autorizada pelo usuário, commit `d06407d`): esperar algum `navigator.serviceWorker.controller` antes de renderizar. **Não bastou:** na implantação seguinte, o teste de favoritos (mobile) falhou 2 vezes em 6 com `/api/favorites` respondido pela rede logo após o login.

**Causa identificada:** o worker do MSW 2.15 se desregistra quando sua última página descarrega (`CLIENT_CLOSED` ao recarregar ou navegar com carregamento completo) e esvazia a lista de páginas ativas. A página seguinte pode continuar controlada por esse worker antigo, que deixa passar para a rede tudo enquanto `activeClientIds` está vazio, até o worker novo registrado pelo MSW assumir o controle. Localmente o worker novo se instala quase na hora; na Vercel, buscar o script leva mais tempo e as primeiras requisições escapam.

**Correção:** antes de renderizar, `main.tsx` espera que a página seja controlada pelo worker ativo do registro atual (`navigator.serviceWorker.ready`, comparando com `navigator.serviceWorker.controller`; o worker novo chama `clients.claim()` ao ativar), por no máximo 3 s. Integração (184), E2E (14) e a suíte de implantação local seguiram aprovadas; o resultado em produção está abaixo.

- "arquivos estáticos": a fonte ainda não tinha carregado quando o teste a procurou (problema do teste). O teste passou a esperar `document.fonts.ready`; 6/6 em seguida.
- **Execuções seguintes:** 3 rodadas completas, 30/30 aprovadas, sem erro no console e sem chamada `/api` fora do service worker; a compra chega ao recibo confirmado sem recarga (o evento `order.updated` pelo Socket.IO simulado); favoritos aparecem na Lista de interesse.

## Diferenças em relação ao build local

- Cabeçalhos e o 404 de `/api/*` só existem na Vercel (`vite preview` não aplica o `vercel.json`).
- A falha única descrita acima só apareceu no ambiente publicado, na primeira execução.

## Erros de infraestrutura

Nenhum ("Target crashed", navegador fechado, timeout, falta de memória ou processo encerrado). Não ficaram navegadores do Playwright nem `vite preview` órfãos.

## Não verificado

- O próximo push em `main` disparando a implantação automática (o vínculo com o repositório foi confirmado pela API; a primeira implantação foi criada pelo conector).
- Navegadores além do Chromium e dispositivos físicos.
- Lighthouse (fica para a etapa de desempenho).
