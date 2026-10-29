# Diário de interações com IA e passagem de contexto

Mantenha este diário de alto nível nos próximos trabalhos do projeto com assistência de IA. Acrescente entradas datadas com o pedido do usuário, decisões e motivos, escopo implementado, verificações executadas, observações humanas/manuais, pendências e pontos de passagem de contexto. Diferencie verificações automatizadas no navegador de revisão visual humana; nunca declare uma verificação não executada. Crie documentos de apoio específicos em `docs` quando necessário. Toda a documentação deve ser escrita e mantida em pt-BR.

## 2026-10-28 — Inicialização solicitada

**Orientação do usuário:** executar `docs/handoffs/coding-agent-bootstrap-draft.md`, manter um diário de alto nível e não enviar código ao remoto sem permissão explícita. O README local inicial corresponde aos requisitos do desafio fornecidos pelo usuário.

**Escopo:** inicializar somente a tela provisória executável e a infraestrutura. Não abrir Figma, implementar funcionalidades do marketplace, criar repositórios remotos, implantar ou fazer push. Nenhum commit é necessário para esta entrega na árvore de trabalho; o arquivo de lock é mantido para um commit futuro.

**Inspeção e decisões:** não foram encontrados aplicação, gerenciador de pacotes, arquivo de lock ou AGENTS.md aplicável. O README inicial foi preservado integralmente em `docs/challenge-requirements.md` antes de escrever as instruções de configuração. Escolhidos npm, Node 24.22.0 LTS instalado, Vite, React, TypeScript estrito, TanStack Router com rotas em código e integração Vite do Tailwind. A skill de boas práticas React foi aplicada na revisão dos componentes.

**Compatibilidade encontrada:** a resolução inicial do npm selecionou MSW 3, em conflito com o requisito de dependência par `msw@^2.10.2` de `@mswjs/socket.io-binding@0.2.0`. Foi selecionado MSW 2.15.0 sem forçar dependências pares. A integração do protocolo Socket.IO permanece deliberadamente sem teste nesta etapa; nenhuma conexão é aberta.

**Ambiente:** o acesso ao registro npm dentro do ambiente restrito falhou com `EAI_AGAIN`; a instalação exigiu ampliação de permissões de rede. Consulte o escopo da inicialização para resultados finais de verificação e versões resolvidas.

**Verificação manual:** nenhuma revisão visual humana foi informada. As verificações automatizadas no navegador e os resultados de auditoria são registrados separadamente após a execução.

**Configuração concluída:** React/Vite/TypeScript estrito, roteamento TanStack tipado e provedor Query, configuração pública validada, cliente Axios inativo, worker MSW vazio carregado dinamicamente e aguardado, estilos neutros Tailwind e configuração shadcn, testes básicos Playwright desktop/mobile, perfis locais Lighthouse CI e somente configuração Vercel. A skill de verificação foi aplicada às fronteiras de inicialização, renderização e worker.

**Verificações executadas:** `npm ci` reproduzível; tipos, build, lint e formatação aprovados. Testes básicos desktop/mobile aprovados com mocks desabilitados e habilitados, quatro verificações ao todo. A inspeção do navegador pelo agente confirmou controle pelo worker e entrega do script com MIME correto, fallback de rota desconhecida e capturas de tela responsivas. Seis execuções Lighthouse sobre o build otimizado produziram relatórios HTML/JSON locais; resultados exclusivos da inicialização e versões estão em `bootstrap-scope.md`. Nenhuma verificação visual humana foi informada.

**Passagem de contexto:** o Lighthouse CI mais recente possui 16 avisos de auditoria de dependências em sua cadeia de ferramentas; a integração do protocolo Socket.IO fica adiada. Não houve implementação de funcionalidades, commit, push ou implantação. Continue registrando aqui as próximas interações, decisões e verificações manuais. A autorização do usuário continua necessária antes de qualquer push.

## 2026-10-28 — Verificação do usuário

**Resultados informados pelo usuário:** `npm run dev` funciona e exibe a tela provisória. O usuário também executou `npm run test:e2e` e informou que todos os testes passaram. Isso confirma a inicialização local de desenvolvimento e uma verificação E2E automatizada executada pelo usuário; não se infere nenhuma verificação visual ou funcional adicional.

## 2026-10-28 — Remoção de configuração obsoleta do TypeScript

**Relato do usuário:** a IDE sinaliza `baseUrl` como obsoleto antes do TypeScript 7. A opção foi removida das configurações TypeScript da aplicação e da raiz, tornando o mapeamento `@/*` explicitamente relativo (`./src/*`). A documentação oficial do TypeScript confirma que `paths` funciona em relação ao arquivo de configuração sem `baseUrl`. Não foi necessário suprimir avisos nem atualizar dependências; o alias correspondente do Vite permanece válido.

**Verificação:** `npm run build` aprovado, incluindo verificação de tipos com TypeScript 5.9.3 do projeto. Verificações Prettier aprovadas para os dois arquivos de configuração alterados. O diagnóstico da IDE em si não foi inspecionado diretamente.

## 2026-10-28 — Revisão de arquitetura pelo usuário

**Revisão manual:** o usuário revisou `ARCHITECTURE.md` e os arquivos individuais mencionados no documento, informando que estava tudo certo. Nenhuma alteração foi solicitada.

## 2026-10-28 — Commit e push da inicialização autorizados

**Orientação do usuário:** fazer commit e push da inicialização revisada antes de prosseguir. Isso autoriza o push da inicialização para `origin` (`Moharu/frontend-challenge`), na branch atual `main`. O repositório do desafio configurado como `upstream` não é um destino de push. Pushes futuros continuam exigindo autorização do usuário.

**Revisão antes do commit:** a árvore de trabalho contém o código da inicialização, ferramentas, arquivo de lock e documentação; saída do build, dependências, relatórios e arquivos locais de ambiente são ignorados. `git diff --check` aprovado. Resultados anteriores de build, lint, formatação e navegador estão registrados acima. Resultados de commit e push foram informados na conversa correspondente e no histórico Git.

## 2026-10-28 — Validação de inicialização e tipos dos testes E2E

**Resultados da revisão:** os dois problemas relatados pelo usuário foram confirmados. A validação de ambiente lançava erros durante a avaliação estática do módulo, antes que o tratamento de rejeição da inicialização pudesse executá-los. Os arquivos E2E estavam fora dos dois projetos TypeScript.

**Alterações:** a validação foi movida para `readEnv()`, chamada dentro de `start()`. A inicialização atribui a URL base validada à instância Axios compartilhada antes da renderização; nenhum dos módulos valida durante a importação. Adicionado `tsconfig.tests.json`, referenciado pela raiz, herdando configurações estritas das ferramentas com bibliotecas DOM e incluindo `tests/**/*.ts`. A documentação de arquitetura foi atualizada.

**Verificação:** build, incluindo tipos da aplicação, ferramentas e testes, lint e testes básicos E2E desktop/mobile aprovados. Uma verificação Chromium executada pelo agente confirmou que URLs de API malformadas e flags de mocks inválidas exibem a mensagem de erro de inicialização, registram a falha capturada e não geram erros de página não tratados; configurações válidas renderizam a tela provisória. Um erro de tipo deliberado e temporário em `tests/` foi detectado pela verificação de tipos da raiz; após sua remoção, a verificação passou. Não se declara revisão humana dessas alterações. Nenhum commit ou push foi realizado nesse acompanhamento.

**Autorização de commit:** posteriormente, o usuário aprovou commit e push dessas correções para `origin/main`. O commit inclui a correção da validação de inicialização, o projeto TypeScript de testes e a documentação correspondente. Os resultados foram informados na conversa e no histórico Git.

## 2026-10-29 — Contratos e base de dados simulada

**Orientação do usuário:** executar `docs/handoffs/coding-agent-data-foundation-draft.md`, manter a interface provisória e não fazer push. O rascunho também proíbe commits/implantação sem autorização separada. O trabalho partiu do commit revisado `c6940d4`; o novo rascunho do usuário e as convenções existentes foram preservados. Não houve acesso ao Figma, obtenção de recursos de design, commits, pushes, alterações remotas ou implantação.

**Escopo implementado:** contratos de transporte organizados por recurso para todos os recursos exigidos, com apenas listagem/detalhe REST de NFT e evento público `nft.updated` implementados. Adicionados comparação exata de ETH decimal, analisadores de fronteira para consultas/recursos/eventos, chamadas Axios, chaves Query normalizadas/cancelamento, cenários determinísticos e catálogo tipado persistido. Os demais endpoints de conta/compra são somente contratos e falham explicitamente em vez de simular sucesso. A interface normal permanece inalterada e não inicia tráfego de negócio.

**Decisões:** escolhido localStorage com chave própria para um pequeno retrato síncrono, inicializado antes dos handlers. Retratos versionados são validados no recarregamento; gravações/restaurações são serializadas e persistidas antes da emissão de eventos. A restauração preserva armazenamento não relacionado e limpa atrasos/falhas/estado de reenvio. Nenhuma dependência foi adicionada. Consistência entre abas é explicitamente não suportada. A massa inicial possui 24 NFTs, três páginas padrão, múltiplas categorias/redes/edições e preços sensíveis à precisão; duas identidades fictícias de usuário não possuem credenciais ou comportamento.

**Constatações sobre o protocolo:** inspecionados README, declarações e código-fonte da integração instalada 0.2.0, além da documentação oficial atual de Socket.IO/Query. O exemplo `io.on` do README difere das exportações reais de `toSocketIo`; foi usado `io.client.emit`. A integração fornece a negociação inicial, mas não a manutenção recorrente da conexão; por isso, o mock fornece pings Engine.IO com limpeza. O cliente usa somente WebSocket/eventos de texto no namespace padrão, ciclo de vida explícito, proteção validada de versões/IDs, invalidação de listas e reconciliação REST ativa. Destinatários privados/geração de sessão e `order.updated` permanecem apenas contratos; não se declara suporte a polling, mensagens binárias, salas ou confirmações de recebimento.

**Fronteira de testes:** um build otimizado de integração separado habilita explicitamente uma ponte não visual no navegador; builds normais removem essa importação e seu arquivo. A estrutura de testes importa a infraestrutura real de Axios/Query/tempo real. Os controles emitem quadros codificados pelo MSW e pelo cliente Socket.IO real, nunca diretamente para callbacks/cache de consumidores. A verificação estrita de tipos TypeScript dos testes permanece habilitada.

**Verificações executadas:** `npm run build:integration` e a execução final de `npm run test:integration` passaram nos 12 casos Chromium, cobrindo comportamento/erros de consultas REST, precisão de ETH, persistência serializada/recarregamento/restauração de corrupção, respostas fora de ordem e cancelamento Axios, recuperação de falhas, entrega real por socket consistente com REST/estado/cache, eventos duplicados/antigos, nova busca após reconexão, limpeza de listeners, manutenção de conexão ociosa com relógio virtual e restauração completa de cenário. Build normal otimizado com mocks e ambos os testes básicos desktop/mobile aprovados; a inspeção dos arquivos gerados confirmou a ausência da estrutura de testes/ponte nessa saída. Tipos e lint aprovados. As verificações no navegador usaram permissões ampliadas para servidor local devido à restrição de portas do ambiente. Nenhuma revisão humana/manual desta etapa foi informada até aqui.

**Passagem de contexto:** referências de contratos/cenários estão em `docs/contracts` e `docs/mock-scenarios.md`; arquitetura e README foram atualizados. A configuração Lighthouse existente foi preservada e a auditoria não foi repetida nesta etapa sem alterações de interface. Os avisos existentes de dependências das ferramentas permanecem como limitações históricas, não corrigidas aqui. Interface do marketplace, autenticação, carrinhos, checkout, estado privado e implementações de compra continuam adiados.

**Verificações finais:** o build otimizado padrão com mocks desabilitados e ambos os testes básicos desktop/mobile também passaram. A estrutura de testes/ponte está ausente nas duas variantes normais de build. Verificações completas de formatação e espaços em branco aprovadas. O `dist/` final é o build padrão; `dist-integration/` mantém o build de protocolo habilitado separadamente. O HEAD Git permanece em `c6940d4`, com esta etapa sem commit, para revisão.

## 2026-10-29 — Acompanhamento dos contratos REST

**Orientação do usuário:** incluir na documentação a tabela de comparação com os oito recursos da seção 5 do desafio e mantê-la atualizada conforme o projeto avançar.

**Alteração:** adicionada a seção de acompanhamento em `docs/contracts/rest.md`, com endpoints/tipos definidos, funcionalidades implementadas e pendências por recurso. A orientação de manutenção exige atualizar o resumo e os detalhes juntos, diferenciando contratos de implementação verificada. O arquivo de requisitos do desafio permanece inalterado.

## 2026-10-29 — Revisão dos testes de integração pelo usuário

**Revisão manual:** o usuário leu todos os testes de integração e informou que estão bons. Nenhuma alteração foi solicitada. Essa revisão de código não implica nova execução dos testes.

## 2026-10-29 — Commit e push da base de dados autorizados

**Orientação do usuário:** fazer commit e push desta etapa para `origin/main` (`Moharu/frontend-challenge`). A entrega inclui contratos, estado persistido e cenários de mocks, integração REST/Socket.IO, testes e documentação atualizada. O arquivo `docs/challenge-requirements.md` permanece inalterado. Resultados anteriores de validação e a revisão dos testes pelo usuário estão registrados acima; `git diff --check` passou antes do commit. Os resultados de commit e push serão informados na conversa e no histórico Git. Pushes futuros continuam exigindo autorização.

## 2026-10-29 — Reconciliação de caches com versões diferentes

**Problema relatado:** uma versão recente no detalhe ou em outra lista fazia o consumidor ignorar todo o evento e deixava listas antigas sem invalidação.

**Correção:** a deduplicação passa a considerar somente IDs e versões de eventos já recebidos, separadamente das versões de cada cache. O detalhe de versão igual ou superior é preservado; listas continuam sendo invalidadas e reconciliadas via REST. Os controles exclusivos de mocks/testes permitem persistir sem emitir e reenviar um envelope pelo Socket.IO real para preparar o cenário de regressão. A documentação de eventos e controles foi atualizada.

**Verificação:** build otimizado de integração, tipos, lint, formatação dos arquivos alterados e `git diff --check` aprovados. Os 14 testes de integração passaram, incluindo dois novos casos com lista antiga e detalhe atualizado via REST nas versões 2 e 3, recebendo evento de versão 2. Ambos verificam atualização da lista, preservação do detalhe e ausência de nova busca ao repetir o evento. Nenhum commit ou push foi realizado.

## 2026-10-29 — Complementação dos contratos pelos campos inventariados

**Correção da especificação:** o usuário forneceu o inventário de campos dos formulários e esclareceu que a orientação anterior proibia consultar Figma sem fornecer todos os campos. Essa lacuna é da especificação, não da implementação. Não foi aberto o Figma. A complementação permanece junto da correção de sincronização de cache, sem implementar novos fluxos.

**Tipos:** cadastro recebe username, email e password; identidade inclui username e permite displayName null. Perfil preserva identificação/versão/bio/avatar e inclui username, ensName e walletNickname, com atualização parcial e contratos específicos de avatar/senha. Carteiras incluem dados descritivos e provedor tipado MetaMask/WalletConnect/Coinbase Wallet; label continua representando o apelido. As duas identidades fictícias receberam usernames. Adicionado `src/contracts/checkout.ts` para dados do colecionador e snapshots compartilhados por pedido e recibo. O corpo de criação preserva cotação/carteira/rede/idempotência, acrescentando collector e collectorNote opcional; endereço e provedor são resolvidos futuramente pela carteira, não duplicados como entradas confiáveis. O contrato order.updated herda os snapshots de Order.

**Decisões documentadas:** ausência é null na leitura e omissão na criação; em atualizações parciais, omitir preserva e null limpa campos anuláveis. ENS, indicação, endereço secundário e observação são opcionais, desviando explicitamente dos asteriscos do layout nos dois primeiros casos. Confirmações de senha ficam no cliente. Bio foi mantida, embora não exigida pelo inventário. “Igual à carteira principal” é somente futura ação de preenchimento, sem estado persistido. Todos os campos do corpo participam da comparação canônica de idempotência; snapshots não são reconstruídos nas repetições, e alterações no checkout não atualizam perfil/carteira automaticamente. A tabela de acompanhamento REST continua marcando esses recursos como somente contratos.

**Verificação:** `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`, `npm run build:integration` e `git diff --check` aprovados. `npm run test:integration` passou nos 14 testes e `npm run test:e2e` nos dois projetos desktop/mobile. A tela provisória continua sem tráfego de negócio; não foram adicionados handlers, validadores ou comportamentos de conta/checkout/pedido. Documentação REST/eventos, arquitetura, cenários e diário foram atualizados em pt-BR. O arquivo de requisitos permanece inalterado. Nenhum commit ou push foi realizado.

## 2026-10-29 — Commit e push da correção e complementação autorizados

**Orientação do usuário:** fazer commit e push da correção de sincronização entre caches e da complementação dos contratos no mesmo commit, para `origin/main` (`Moharu/frontend-challenge`). As verificações e decisões estão registradas acima. `git diff --check` passou e `docs/challenge-requirements.md` permanece inalterado. Os resultados serão informados na conversa e no histórico Git. Pushes futuros continuam exigindo autorização.

## 2026-10-29 — Organização dos rascunhos de orientação

**Alteração solicitada:** movidos os três rascunhos `coding-agent-…-draft` para `docs/handoffs/`, preservando seus conteúdos. Referências no diário e caminhos de exclusão do Prettier foram atualizados.

## 2026-10-29 — Descoberta pública (`docs/handoffs/coding-agent-discovery-draft-pt-br.md`)

**Troca de agente:** a etapa foi iniciada com Codex, que ficou sem créditos antes de concluir; a retomada foi feita com Claude Code a partir do log da conversa e da árvore de trabalho. Nenhum commit, push ou deploy.

**Estado encontrado:** implementação, testes, referências visuais, assets locais e `docs/discovery.md` já presentes; faltavam o relatório de verificação citado nesse documento e este registro. Havia 12 perfis temporários do Chromium (`C:\Users\…\lighthouse.*`) criados na raiz pelo Lighthouse sob WSL; foram removidos e o script de auditoria passou a limpá-los.

**Alterações na retomada:** `preload` com `media` das imagens de fundo do hero em `index.html`; limpeza dos perfis temporários em `scripts/audit-lighthouse.mjs`; `docs/discovery-verification.md` criado.

**Verificação:** tipos, lint, formatação, build normal e de integração aprovados; 26 testes de integração e 6 E2E aprovados. Lighthouse (medianas de 3 execuções): desktop 99/100/100/100 nas duas rotas; mobile início 88 e detalhe 86 em desempenho, abaixo da meta de 90, com 100 nas demais categorias. Causas e melhoria sugerida (derivados otimizados das artes PNG de ~2 MB) registradas no relatório, sem aplicação. As referências visuais foram inspecionadas pelo agente; a limitação de elementos fixos em capturas de página inteira está documentada. Não se declara revisão humana desta etapa.

## 2026-10-29 — Artes responsivas em WebP

**Orientação do usuário:** gerar versões menores das artes, mantendo os originais do Figma.

**Alterações:** `scripts/optimize-artwork.mjs` gera WebP 240/480/800/1254px das quatro artes distintas (os 13 PNG versionados são cópias de quatro imagens) com o Chromium do Playwright, sem nova dependência. `artImage()` fornece `srcSet`/`sizes` a todos os usos; os PNG permanecem em `public/assets/figma/`. A troca revelou dependência do layout na largura intrínseca da imagem de promoção (1px a menos na página desktop); corrigida com `flex-shrink: 0`.

**Verificação:** tipos, lint, builds, 26 testes de integração e 6 E2E aprovados. As quatro referências visuais foram regeneradas depois de inspecionar os diffs (somente pixels de compressão dentro das artes) e a captura do detalhe. Lighthouse mobile: início 89, detalhe 85; desktop 99 nas duas rotas. O download da arte principal caiu de ~1 s para ~170 ms, mas o LCP mobile continua limitado pela cadeia bundle → MSW → rota → API; a análise anterior que atribuía o déficit principalmente às imagens foi corrigida no relatório.

## 2026-10-29 — Navegação inferior mobile conforme o Figma

**Revisão manual do usuário:** com `npm run dev:mocks`, as artes WebP foram aprovadas visualmente. Comparando com o Figma, a navegação inferior mobile não correspondia ao desenho.

**Correção:** a barra plana foi substituída pelo formato do Figma: recorte curvo central (caminho de `mobile-home-Vector.svg` aplicado como máscara de largura fixa, com laterais extensíveis), cantos de 29px, sombra superior e botão central com o gradiente de `mobile-home-Ellipse39.svg`, centralizado na borda da barra.

**Verificação:** capturas da viewport em 390, 414 e 700px inspecionadas pelo agente, sem distorção da curva. Lint e formatação aprovados; 6 E2E e 26 testes de integração aprovados. Somente a referência visual do início mobile mudou; o diff foi inspecionado (restrito à barra) antes de regenerá-la.

**Revisão manual do usuário:** a navegação inferior funciona e acompanha a rolagem corretamente em 390, 414 e 700px; tocar no botão central abre o diálogo de indisponibilidade.

## 2026-10-29 — Revisão e commit da descoberta pública autorizados

**Revisão manual do usuário:** leitura do código das rotas `index` e `nft` e dos testes de descoberta E2E e de integração, aprovados sem alterações.

**Orientação do usuário:** fazer commit e push da etapa de descoberta para `origin/main` (`Moharu/frontend-challenge`). As verificações estão registradas acima e em `docs/discovery-verification.md`; `git diff --check` passou. Pendência registrada para a passagem final de desempenho antes do deploy: encurtar a cadeia crítica do MSW no mobile. Pushes futuros continuam exigindo autorização.

## 2026-10-29 — Carrinho persistente do visitante (`docs/handoffs/coding-agent-cart-draft-pt-br.md`)

**Orientação do usuário:** executar o rascunho do carrinho sem commit/push. O limite da integração Figma foi atingido; o usuário forneceu capturas dos frames `11:1278` e `16:360` e os SVGs pedidos (lixeira, −/+, pontos do carrossel). O ponto preenchido foi derivado de `detail-CarouselDots.svg`, porque as duas exportações de ponto recebidas eram idênticas.

**Decisão aprovada pelo usuário:** o cupom passa a pertencer ao carrinho; `QuoteRequest` deixa de recebê-lo e a cotação futura o lê do carrinho e o revalida. Nenhum outro conflito com o README ou o código foi encontrado nas decisões do rascunho.

**Implementação:** aritmética ETH completa em `bigint` com desconto arredondado para baixo e formatação separada; contratos do carrinho com validador; token opaco de visitante emitido pela API e enviado pelo Axios; estado simulado `schemaVersion` 3 com carrinhos, visitantes, cupons e taxas, adoção do retrato mais recente entre abas; handlers REST com 400/401/404/409/503; rota `/cart` desktop/mobile, badge, adicionar/comprar no detalhe, cupom, conflitos, anúncios, foco, skeleton, estados de erro/vazio e recomendações; reconciliação por `nft.updated` e reconexão; plugin de `modulepreload` do MSW. Decisões e desvios em `docs/cart.md`.

**Correções durante a verificação:** falha em atualização de fundo deixava de exibir o carrinho (agora mantém os dados com aviso); a margem da seção de recomendações colapsava antes do rodapé; regras de CSS existentes (`.related > div`, `td`) quebravam o carrossel e os cards mobile. Testes ajustados: nome "Comprar NFT" exato (colidia com "Como comprar NFTs"), clique por evento em botão `aria-disabled`, espera da carga inicial antes de eventos, atraso para compartilhar a requisição que falha.

**Incidente:** um `prettier --write .` executado pelo agente reformatou o rascunho não versionado do usuário (uma linha em branco inserida). O arquivo foi restaurado byte a byte (18314 bytes, estrutura conferida com a leitura inicial) e `docs/handoffs` passou a ser ignorado pelo Prettier.

**Verificação:** tipos, lint, formatação, builds normal e de integração aprovados; 52 testes de integração e 8 E2E aprovados. Referências visuais novas do carrinho e regeneradas do detalhe inspecionadas pelo agente. Lighthouse mobile antes/depois do pré-carregamento: início 88/88 (LCP 3369 → 3156 ms), detalhe 84/83 (LCP 3890 → 3803 ms); desktop 98–99; demais categorias 100. A meta de desempenho mobile continua não atingida; causas em `docs/cart-verification.md`. Não se declara revisão humana desta etapa.

## 2026-10-29 — Revisão manual do carrinho e ajustes de navegação

**Revisão manual do usuário:** zoom verificado e aprovado. Teclado virtual será verificado após o deploy na Vercel; duas abas simultâneas serão verificadas pelo usuário após estes ajustes.

**Problemas relatados e correções:** (1) anel de foco do campo de cupom fora do lugar: campos de texto/selects agora desenham o anel dentro da borda; (2) Início e Mercado destacados juntos na página inicial: o TanStack Router marca como ativos todos os links para a rota atual, então os dois links passaram a usar `useLinkProps` com estado ativo e `aria-current` definidos pela posição do catálogo, e o cabeçalho desktop ficou fixo no topo com espaço reservado para âncoras; (3) selo de "Carteiras compatíveis" adicionado conforme o Figma, com padding uniforme e largura total no rodapé mobile; (4) clicar em Início descartava filtros/ordenação: Início, Mercado, busca e o Início mobile preservam os parâmetros atuais.

**Verificação:** script do agente confirmou destaque correto no topo/catálogo/detalhe, parâmetros preservados e rolagem; capturas de foco (desktop/mobile), selo e cabeçalho fixo inspecionadas. Tipos, lint, formatação, 52 testes de integração e 8 E2E aprovados; as seis referências visuais foram regeneradas após inspecionar os diffs (selo no rodapé, Mercado não mais destacado no topo do início, rodapé mobile reorganizado). Nenhum commit ou push.

## 2026-10-29 — Busca, hover, cupom, drawer e barra fixa mobile

**Problemas relatados pelo usuário:** busca desktop fora do cabeçalho; "Explorar" mobile com aparência estranha após o toque; placeholder do cupom cortado no mobile; drawer de filtros com recorte lateral; pedido de barra de busca/filtros fixa no topo do catálogo mobile.

**Correções:** busca desktop agora expande inline no cabeçalho (mantém filtros, volta à página 1, Escape/× devolvem o foco); a barra da página inicial ficou somente mobile e passou a ser fixa no topo com fundo de largura total; hover restrito a `@media (hover: hover)` (o hover preso em toque pintava o link do hero); cupom mobile com texto de 16px e placeholder de 12px; drawer de filtros em tela cheia no mobile.

**Teste instável encontrado e corrigido:** o caso de falhas do carrinho falhava às vezes porque a carga inicial do carrinho no cabeçalho, após recarregar `/`, podia consumir a falha de uso único preparada pelo teste. O teste agora espera o cabeçalho carregar ("Carrinho, 3 itens") antes de preparar os controles; 20 repetições (desktop/mobile) aprovadas. Uma tentativa de usar `retryOnMount: false` no carrinho foi revertida por não ser a causa.

**Verificação:** capturas do agente (busca no cabeçalho, Explorar após toque, drawer, cupom em 390px, barra fixa no topo e ao rolar); tipos, lint, formatação, 52 testes de integração e 8 E2E aprovados; referências mobile de início e carrinho regeneradas após inspecionar os diffs. Nenhum commit ou push.

## 2026-10-29 — Abrir a busca do cabeçalho rolava ao topo

**Problema relatado pelo usuário:** no desktop, clicar no botão de busca do cabeçalho rolava a página para o topo.

**Causa confirmada:** o `scroll-padding-top` da página (adicionado para o cabeçalho fixo) fazia o navegador considerar encoberto qualquer elemento dentro do próprio cabeçalho; focar o campo (autoFocus) rolava a página até a posição original do cabeçalho. O agente reproduziu o salto (903 → 441) e verificou que Shift+Tab até o cabeçalho também saltava (900 → 0).

**Correção:** o espaço para a área fixa passou a ser `scroll-margin-top` nos alvos de conteúdo (links, botões, campos e elementos com `id`), excluindo o cabeçalho e a barra fixa mobile; o campo recebe foco com `preventScroll`. O campo aberto tem a altura do botão "Entrar", sem alterar a altura do cabeçalho.

**Verificação:** clique real e foco programático no cabeçalho, Shift+Tab até ele e foco na busca fixa mobile mantêm a posição; "Explorar" continua levando o catálogo para baixo do cabeçalho; foco por teclado no conteúdo permanece visível abaixo dele. Tipos, lint, formatação, 52 testes de integração e 8 E2E aprovados, sem mudança nas referências visuais. Nenhum commit ou push.

## 2026-10-29 — × limpa a busca do cabeçalho

**Orientação do usuário:** no desktop, clicar no × deve limpar a busca.

**Alteração:** × ("Limpar busca") remove o termo ativo, mantém os demais filtros/ordenação, volta à página 1 e fecha o campo; sem termo ativo, apenas fecha. Escape continua só fechando. Corrigido também um problema encontrado na verificação: o campo era remontado ao enviar a busca e perdia o foco, impedindo o Escape; agora o campo não é remontado e o Escape é tratado no formulário.

**Verificação:** script do agente (busca com categoria/ordenação, Escape mantém o termo, × limpa só o termo e devolve o foco); tipos, lint, formatação, 52 testes de integração e 8 E2E aprovados. Nenhum commit ou push.

## 2026-10-29 — Verificação manual com duas abas

**Revisão manual do usuário:** com duas abas visíveis ao mesmo tempo, alterações em uma não aparecem na outra; ao ocultar e voltar para uma aba (alternando abas na janela), elas ficam sincronizadas. O usuário considerou esse comportamento aceitável. A explicação (nova busca ao recuperar o foco + adoção do retrato mais recente pelo store) foi registrada em `docs/cart.md`. Nenhum código foi alterado.

## 2026-10-29 — Commit e push do carrinho autorizados

**Orientação do usuário:** fazer commit e push da etapa do carrinho e dos ajustes de navegação/interface para `origin/main` (`Moharu/frontend-challenge`). Verificações registradas acima e em `docs/cart-verification.md`; `git diff --check` aprovado. Pendências: teclado virtual após o deploy na Vercel; meta de desempenho mobile. Pushes futuros continuam exigindo autorização.

## 2026-10-29 — Correções da revisão do carrinho (`docs/handoffs/coding-agent-cart-fixes-draft-pt-br.md`)

**Orientação do usuário:** verificar o novo handoff e resolver os três pontos da revisão de `480dbc7`, sem commit/push.

**Resolução:** (1) leituras do carrinho na mesma fila das escritas no servidor simulado e regra única `keepNewestCart` no cliente para leituras e mutations; atraso de leitura dos cenários passou a ser latência de resposta para reproduzir o caso; teste de regressão com `nft.updated` real, comprovadamente falhando sem a correção; (2) `ARCHITECTURE.md` reescrito e documentos de cenários/REST/carrinho alinhados; (3) `fields.quantity` com mensagens legíveis, sem novo campo estruturado por não haver consumidor que precise do número, com teste das respostas 409.

**Verificação:** tipos, lint, formatação, builds, 56 testes de integração e 8 E2E aprovados. Evidências em `docs/cart-verification.md`. Nenhum commit ou push.

**Autorização de commit:** o usuário aprovou commit e push destas correções para `origin/main`, incluindo o handoff `docs/handoffs/coding-agent-cart-fixes-draft-pt-br.md`. Pushes futuros continuam exigindo autorização.

## 2026-10-29 — Ajustes finos do carrinho (`docs/handoffs/coding-agent-cart-nits-draft-pt-br.md`)

**Orientação do usuário:** executar o handoff de ajustes finos da revisão de `fec94b1`, sem commit/push.

**Resolução:** mensagem própria para limite já atingido (principal e `fields.quantity`), com teste dos casos de restante zero e positivo; espera abortável dos cenários como função local, sem `this`; teste de regressão de versão sem espera fixa, usando o novo diagnóstico `cartQuery()` da ponte. Um caso intermitente sob carga no teste de falhas foi estabilizado com o cenário persistente `http-error`.

**Verificação:** tipos, lint, formatação, build de integração e 56 testes de integração (duas execuções completas) aprovados; casos alterados repetidos sem falhas. Detalhes em `docs/cart-verification.md`. Nenhum commit ou push.

**Autorização de commit:** o usuário aprovou commit e push destes ajustes para `origin/main`, incluindo o handoff `docs/handoffs/coding-agent-cart-nits-draft-pt-br.md`. Pushes futuros continuam exigindo autorização.

## 2026-10-29 — Cadastro, login e sessão (`docs/handoffs/coding-agent-session-draft-pt-br.md`)

**Orientação do usuário:** executar o handoff de sessão, sem commit/push. A etapa começou na extensão do VS Code (WSL) e foi retomada no aplicativo desktop do Claude a partir do registro da conversa anterior, que parou durante a estabilização dos testes de sessão.

**Entregue:** cadastro, login, logout, recuperação no refresh e expiração de sessão sobre o MSW (token opaco, hash PBKDF2 na seed, geração por sessão); mesclagem única do carrinho de visitante no login; retorno ao fluxo validado contra redirecionamento aberto; isolamento do cache do carrinho e do tempo real por usuário e geração; `VISITOR_INVALID` separado de `SESSION_INVALID`; diálogo do Figma no desktop e tela cheia com "Voltar" no mobile; cabeçalho com conta e "Sair". Política e desvios em `docs/session.md`.

**Correção na retomada:** o foco não voltava ao gatilho ao fechar o login (o fechamento é pela troca de rota, então o Radix não devolve o foco); corrigido em `AuthScreen`. Os demais ajustes foram nos testes (nome de exibição no cabeçalho, diálogo lazy, ausência de barra de navegação no carrinho mobile, corridas de tempo).

**Verificação:** tipos, lint, formatação, builds, 82 testes de integração e 8 E2E aprovados; suíte de sessão repetida 5 vezes sem falhas. Referências visuais desktop atualizadas após inspeção (ícone do "Entrar"). Lighthouse dentro da oscilação da etapa anterior; mobile segue abaixo de 90. Detalhes em `docs/session-verification.md`. Nenhum commit ou push.

## 2026-10-29 — Login sobre a página atual

**Verificação manual do usuário:** login, cadastro, credenciais inválidas, erros de formulário e mesclagem de carrinhos aprovados. **Orientação do usuário:** no desktop, manter o estado do app ao fundo; o diálogo sempre voltava à página inicial sem filtros.

**Alteração:** aberto dentro do app, o diálogo usa mascaramento de rota (TanStack Router): o roteador continua na página atual (sinalizada no estado do histórico) e a barra de endereço mostra `/login?redirect=…`. A página não é remontada, então filtros, paginação, rolagem e rascunhos permanecem; fechar volta uma entrada do histórico e o login bem-sucedido a substitui. Acesso direto ou recarga de `/login` continua pela rota real. Vale também para o mobile e para a expiração de sessão. Dois problemas encontrados na verificação: a navegação rolava a página ao topo (`resetScroll: false`) e, numa localização mascarada, o roteador perde o hash (`#catalogo`); o destino passou a viajar no estado do histórico.

**Verificação:** novo teste de integração (marcador no DOM, URL e rolagem preservados; carrinho atrás do login; "voltar" não reabre o diálogo); tipos, lint, formatação, builds, 84 testes de integração e 8 E2E aprovados; suíte de sessão repetida 3 vezes sem falhas. Detalhes em `docs/session.md` e `docs/session-verification.md`. Nenhum commit ou push.

## 2026-10-29 — Recarregar com o diálogo de login aberto

**Problema relatado pelo usuário:** rolar a página, abrir o login/cadastro, recarregar e fechar o diálogo fazia a página rolar até a posição anterior à recarga; o esperado é permanecer no topo, como após qualquer recarga.

**Causas confirmadas (reprodução em início, catálogo com hash, detalhe e carrinho):** fechar voltava uma entrada do histórico, que pertence à carga anterior; a restauração de rolagem do próprio navegador ficava pendente enquanto o diálogo travava a rolagem e era aplicada ao fechar; com `#catalogo`, a navegação rolava até o hash.

**Correção:** se o diálogo está na entrada em que o documento foi carregado, fechar substitui a entrada pela página, sem rolar até o hash; a restauração do navegador fica em `manual` desde a inicialização até o fechamento. Novo teste de integração para desktop e mobile.

**Verificação:** tipos, lint, formatação, builds, 86 testes de integração e 8 E2E aprovados; suíte de sessão repetida 3 vezes (90/90). Nenhum commit ou push.

## 2026-10-29 — Recarga no mobile e primeira abertura do login

**Problemas relatados pelo usuário:** no mobile, recarregar em login/cadastro mostrava rapidamente a tela anterior antes do diálogo; depois de uma recarga, a primeira abertura do login/cadastro demorava visivelmente mais.

**Causas confirmadas:** (1) durante cerca de 300 ms após a recarga, o React renderizava a página de fundo antes do diálogo de tela cheia (amostragem por quadro: 18 quadros descobertos); (2) o chunk do diálogo só era baixado no primeiro clique, e, mesmo pré-carregado, `lazy` suspendia uma vez e o React 19 segurava o fallback de Suspense por ~300 ms (perfil de CPU quase todo ocioso; ≈310 ms na primeira abertura, ≈50 ms na segunda).

**Correção:** classe `auth-restoring` no `<html>` desde a inicialização quando a página carrega com o diálogo aberto, cobrindo a tela no mobile até o diálogo montar; pré-carregamento do chunk depois do evento `load` (e imediato numa recarga com o diálogo aberto); componente renderizado diretamente depois de carregado. Primeira abertura ≈14 ms. Um pré-carregamento logo após a primeira renderização reduziu o Lighthouse mobile do detalhe (82 → 80); adiado para depois do `load`, voltou aos valores da etapa (87/82 mobile, 98/99 desktop).

**Verificação:** novo teste de integração mobile (nenhum quadro descoberto; primeira abertura sem fallback); tipos, lint, formatação, builds, 87 testes de integração e 8 E2E aprovados; suíte de sessão repetida 3 vezes sem falhas. Nenhum commit ou push.

## 2026-10-29 — Correções da revisão da sessão (`docs/handoffs/coding-agent-session-fixes-draft-pt-br.md`)

**Orientação do usuário:** verificar o novo handoff e resolver os pontos da revisão de `0fedb5b`, sem commit/push. O usuário informou que fornece capturas do Figma quando necessário.

**Resolução:** desvios do Figma documentados e conferidos no código; guarda de rota privada com três casos (autenticado, anônimo, não confirmado por falha transitória) e estado de nova tentativa, testada por uma rota protegida exclusiva do build de integração; limitação de múltiplas abas registrada.

**Verificação:** tipos, lint, formatação, builds, 93 testes de integração e 8 E2E aprovados; rota de teste ausente do build normal. Detalhes em `docs/session-verification.md`. Nenhum commit ou push.

## 2026-10-29 — Checkout até a revisão validada (`docs/handoffs/coding-agent-checkout-draft-pt-br.md`)

**Orientação do usuário:** executar o handoff do checkout, sem commit/push. O usuário forneceu as capturas dos frames Desktop / Pagamento e Mobile / Pagamento.

**Entregue:** rota `/checkout` protegida (com pré-condições de carrinho e passos `?step=` no mobile), dados do colecionador com pré-preenchimento pela carteira e pela conta, rascunho em `sessionStorage` por usuário (sobrevive a refresh e expiração; descartado no logout e na troca de usuário), carteiras no MSW (seed, validação compartilhada, regra de primária/secundária, cadastro no checkout), conexão simulada com recusa e desconexão detectada pela API, cotação com `walletId` (titularidade, conexão, versão, disponibilidade, cupom com expiração, taxa da rede da carteira, validade curta) e regra de nova confirmação quando os valores mudam. "Confirmar compra" para na revisão validada; nenhum pedido é criado. Detalhes e desvios em `docs/checkout.md`.

**Revisão manual do usuário durante a etapa:** espaço vazio no fim das páginas do checkout mobile e o aviso cobrindo o botão (corrigidos: sem reserva da navegação inferior; avisos no topo no checkout mobile e estado da conexão anunciado pela própria região de status); rótulos apenas com ou sem asterisco, sem "(opcional)"; placeholder de "ENS ou carteira secundária" cortado; ajudas de formato só após envio inválido; "Nome ENS" como lista, como no frame.

**Verificação:** tipos, lint, formatação, builds, 118 testes de integração (25 novos do checkout, repetidos 3 vezes) e 10 E2E (com as referências visuais do pagamento) aprovados; varredura de 390, 414, 768 e 1440px sem overflow horizontal. Lighthouse não executado, conforme o handoff. Detalhes em `docs/checkout-verification.md`. Nenhum commit ou push.
