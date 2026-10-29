# Diário de interações com IA e passagem de contexto

Mantenha este diário de alto nível nos próximos trabalhos do projeto com assistência de IA. Acrescente entradas datadas com o pedido do usuário, decisões e motivos, escopo implementado, verificações executadas, observações humanas/manuais, pendências e pontos de passagem de contexto. Diferencie verificações automatizadas no navegador de revisão visual humana; nunca declare uma verificação não executada. Crie documentos de apoio específicos em `docs` quando necessário. Toda a documentação deve ser escrita e mantida em pt-BR.

## 2026-10-28 — Inicialização solicitada

**Orientação do usuário:** executar `coding-agent-bootstrap-draft.md`, manter um diário de alto nível e não enviar código ao remoto sem permissão explícita. O README local inicial corresponde aos requisitos do desafio fornecidos pelo usuário.

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

**Orientação do usuário:** executar `docs/coding-agent-data-foundation-draft.md`, manter a interface provisória e não fazer push. O rascunho também proíbe commits/implantação sem autorização separada. O trabalho partiu do commit revisado `c6940d4`; o novo rascunho do usuário e as convenções existentes foram preservados. Não houve acesso ao Figma, obtenção de recursos de design, commits, pushes, alterações remotas ou implantação.

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
