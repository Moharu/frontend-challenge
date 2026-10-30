# Próxima etapa: implantação na Vercel e verificação do site publicado

## Objetivo

Publicar a demonstração na Vercel e comprovar que o site publicado funciona como o build local, antes da etapa de desempenho (que medirá a URL publicada) e da revisão final.

A etapa tem duas partes:

1. **Preparação:** revisar a configuração de build e da Vercel, cabeçalhos e o comportamento sem o service worker, e criar uma verificação automatizada que rode contra uma URL publicada.
2. **Implantação e verificação do site publicado.**

**Autorização do usuário para esta etapa:** você pode criar o projeto na Vercel e implantar, usando o conector da Vercel disponível na sua sessão.

- **Nome do projeto:** `jungle-gaming-challenge-joao`, para que a URL de produção seja `https://jungle-gaming-challenge-joao.vercel.app`. Se o nome estiver indisponível, use uma variação próxima (por exemplo `jungle-gaming-challenge-joao-telo`) e informe a URL final.
- **Origem preferida:** vincule o projeto ao repositório `Moharu/frontend-challenge`, branch `main`, com implantação automática a cada push. Assim o site publicado corresponde ao código do repositório, como exige o requisito.
  - Se o conector não permitir a vinculação ao GitHub, implante a partir da árvore de trabalho **em um estado já commitado**, registre o hash do commit publicado e explique a limitação.
- Esta autorização vale **só** para criar e configurar esse projeto e implantar. Não crie outros projetos nem altere configurações de conta, equipe ou domínio além do necessário para esse projeto. **Commit e push continuam exigindo autorização separada do usuário.**
- Antes de implantar, conclua a Parte 1 e mostre ao usuário a configuração que será aplicada (framework, comandos, diretório de saída, versão do Node, variáveis).

Fora desta etapa: otimizações de desempenho, mudanças visuais, revisão final de acessibilidade e documentação.

## Ponto de partida e referências

- Repositório: https://github.com/Moharu/frontend-challenge
- Último commit revisado: `98f9d58` (conta, carteiras e favoritos).
- Requisitos: `docs/challenge-requirements.md`, em especial a implantação pública com acesso direto às rotas e a execução a partir de um clone limpo, sem serviços privados.
- Configuração atual: `vercel.json`, `vite.config.ts` (inclui o `modulepreload` do MSW), `.env.example`, `.env.mocks`, `.nvmrc` (Node 24.22.0) e `package.json` (`engines`).
- Contexto: `ARCHITECTURE.md`, `README.md`, `docs/mock-scenarios.md` e `docs/session.md`.

Inspecione o checkout atual antes de editar e preserve trabalho mais recente. Commit e push continuam exigindo autorização separada; a implantação está autorizada nos termos acima.

## Parte 1 — Preparação

### 1.1 Build de produção

- Confirme que o build normal (`npm run build`) gera `dist/` com:
  - mocks habilitados por padrão;
  - **sem** a ponte de testes (`window.__KURIO_TEST__`), a rota `/__private` e a rota `/__protocol`;
  - `mockServiceWorker.js` na raiz;
  - fontes, artes e `robots.txt` incluídos.

  Os testes existentes já verificam parte disso; complete o que faltar.
- **Versões na Vercel:** confirme que o Node 24 indicado em `.nvmrc` e `engines` é aceito e documente como fixá-lo no projeto da Vercel (configuração do projeto ou `engines`). Verifique se a restrição de npm em `engines` (`>=11 <12`) quebra a instalação na Vercel; se puder quebrar, ajuste e justifique.
- **Variáveis de ambiente:** liste em `.env.example` e no README as variáveis necessárias na Vercel. A configuração padrão deve funcionar sem nenhuma variável definida no painel. Nenhum segredo.
- Instalação limpa (`npm ci`) e build a partir de um clone limpo funcionando, como exige o requisito.

### 1.2 `vercel.json`

- **Roteamento.** O arquivo usa a chave legada `routes`. Avalie migrar para `rewrites` (o formato recomendado atualmente, em que arquivos existentes têm prioridade). O resultado deve ser:
  - acesso direto e refresh em todas as rotas da SPA (`/`, `/nfts/:id`, `/cart`, `/login`, `/signup`, `/checkout`, `/orders/:id`, `/account/*`) servem o `index.html`;
  - arquivos existentes (`/assets/*`, `/mockServiceWorker.js`, `/robots.txt`, fontes) são servidos como arquivos;
  - **`/api/*` não é reescrito para o `index.html`.** Se o service worker não estiver ativo, uma chamada à API não pode receber HTML com status 200 e quebrar a análise de JSON de forma confusa. Garanta que ela falhe de forma clara (por exemplo, 404 da plataforma) e que a interface mostre o estado de erro já existente.
- **Cabeçalhos:**
  - `index.html` e `mockServiceWorker.js`: `Cache-Control: no-cache` (ou equivalente), para que uma nova versão chegue sem ficar presa a um service worker antigo;
  - `/assets/*` com nome por hash: cache longo e `immutable`;
  - `mockServiceWorker.js` com `Content-Type` JavaScript.

  Cabeçalhos de segurança simples (`X-Content-Type-Options: nosniff`, `Referrer-Policy`) são bem-vindos. Não adicione CSP nesta etapa: ela pode bloquear o MSW e fica para a revisão final, se houver tempo.
- Rotas desconhecidas exibem a página "Página não encontrada" da aplicação. Documente que o status HTTP é 200 por ser SPA.

### 1.3 Comportamento do service worker em produção

- **Primeira visita:** a interface só inicia depois de o MSW estar ativo, como hoje. Confirme que isso vale numa origem HTTPS nova, sem service worker prévio.
- **Atualização:** uma nova implantação deve ativar o worker novo sem exigir que o usuário limpe dados. Verifique a estratégia da versão do MSW instalada e documente.
- **Falha no registro** (navegador sem service worker ou bloqueio): a interface mostra uma mensagem clara de que a demonstração depende desse recurso, sem tela em branco nem erro de JSON.

### 1.4 Verificação automatizada contra uma URL

Crie uma configuração do Playwright separada, por exemplo `playwright.deploy.config.ts`, com o script `npm run test:deploy`.

- Recebe a URL pela variável `DEPLOY_URL` e não sobe servidor local.
- Usa somente o comportamento público, porque o build publicado não tem a ponte de testes: nada de controles de cenário.
- Mantém o limite de workers e isola o estado com contextos novos do navegador.
- Cenários de fumaça, em Chromium desktop e mobile:
  1. acesso direto e refresh em `/`, `/nfts/nft-001`, `/cart`, `/login`, `/signup`, uma rota desconhecida e as rotas privadas (que levam ao login e voltam);
  2. `mockServiceWorker.js` com status 200, tipo JavaScript e os cabeçalhos de cache definidos; um arquivo de `/assets/` com cache longo; `/api/qualquer` sem `index.html`;
  3. a conexão Socket.IO simulada se estabelece (pelo indicador observável que já existir, sem depender da ponte);
  4. login com uma credencial fictícia do README, adicionar ao carrinho, checkout com a carteira semeada, confirmar e chegar ao recibo confirmado;
  5. favoritar e ver na Lista de interesse;
  6. nenhum erro no console e nenhuma requisição `/api` que saia do navegador sem ser interceptada.

Rode essa verificação contra o build local servido por `vite preview` para validá-la antes de existir a URL. Não execute o Lighthouse.

### 1.5 Documentação da Parte 1

No README, uma seção "Implantação" com:

- a configuração do projeto na Vercel (framework, comando de build, diretório de saída, versão do Node, variáveis), suficiente para reproduzi-lo em outra conta;
- a implantação automática por push em `main`;
- os cabeçalhos e o roteamento adotados;
- como rodar `npm run test:deploy`;
- **como redefinir o estado da demonstração publicada**, que não tem ponte de testes. O README já cita as chaves do `localStorage`. Revise para cobrir todas as chaves atuais (incluindo as de `sessionStorage`) e, se for simples e honesto, ofereça um caminho na interface ou documente "limpar dados do site" no navegador.

Ao fim da Parte 1, informe o que mudou e a configuração que será aplicada na Vercel.

## Parte 2 — Implantação e verificação do site publicado

- **Commit.** As mudanças da Parte 1 precisam estar no código publicado. Se a implantação depender delas e ainda não houver commit autorizado, **peça ao usuário a autorização de commit (e de push, se o projeto estiver vinculado ao GitHub)** antes de implantar. Não implante uma árvore com mudanças não commitadas.
- Crie e configure o projeto `jungle-gaming-challenge-joao` conforme a autorização acima e acompanhe o build na Vercel até o fim. Em caso de falha de build, leia o log, corrija e documente a causa.
- Rode `DEPLOY_URL=<url> npm run test:deploy` contra a URL de produção e confira manualmente, com o painel de rede, os pontos que a automação não cobrir.
- Registre em `docs/deploy-verification.md`: URL, commit publicado, data, resultados, cabeçalhos observados e qualquer diferença em relação ao build local.
- Atualize o README com a URL pública e o commit verificado.
- Se algo falhar só no ambiente publicado, investigue e corrija na configuração. Descreva a causa no documento de verificação.

## Verificação e entrega

Execute tipos, lint (com `check:bom`), formatação, build, build de integração, testes de integração, E2E e a nova verificação contra o build local, com o limite de workers. **Não execute o Lighthouse nesta etapa**: a etapa de desempenho vai medir a URL publicada.

**Fique atento a erros de infraestrutura** ("Target crashed", navegador fechado, timeout do servidor de pré-visualização, falta de memória, processo encerrado). Registre-os no documento de verificação, investigue as repetições em vez de usar retentativas e confirme ao final que não ficaram navegadores nem servidores de pré-visualização órfãos.

Ao concluir, informe arquivos alterados, a configuração aplicada na Vercel, a URL de produção, o commit publicado e os resultados.

**Pare ao fim da Parte 2. Não avance para desempenho nem revisão final. Commit e push só com autorização do usuário; a autorização de implantação vale apenas para o projeto `jungle-gaming-challenge-joao` desta etapa.**
