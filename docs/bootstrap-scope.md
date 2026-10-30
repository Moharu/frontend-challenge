# Escopo da inicialização e passagem de contexto

> **Registro histórico** da etapa de inicialização, verdadeiro quando escrito; não descreve o estado atual. Estado atual: [README](../README.md), [`ARCHITECTURE.md`](../ARCHITECTURE.md), [contratos](contracts/), [cenários](mock-scenarios.md) e [rastreabilidade](requirements-traceability.md).

Concluída em 2026-10-28. Trata-se de infraestrutura e uma tela provisória neutra, não da implementação do marketplace. Não houve acesso ao Figma, alteração remota, commit, push, vinculação de projeto ou implantação. O arquivo de lock está pronto para um commit futuro com o restante da inicialização.

## Ambiente de execução e pacotes

Node 24.22.0 LTS, npm 11.19.1. `.nvmrc` fixa o ambiente de execução; engines exigem Node 24 e npm 11. O Vite 8 usa o plugin React e o plugin Vite do Tailwind 4. O TypeScript 5.9 usa verificação estrita. ESLint 10 e seus plugins possuem requisitos compatíveis de dependências pares. O arquivo de lock fixa todo o grafo de dependências.

| Pacote                        | Versão resolvida |
| ----------------------------- | ---------------- |
| `@eslint/js`                  | 10.0.1           |
| `@lhci/cli`                   | 0.15.1           |
| `@mswjs/socket.io-binding`    | 0.2.0            |
| `@playwright/test`            | 1.64.1           |
| `@tailwindcss/vite`           | 4.3.3            |
| `@tanstack/react-query`       | 5.105.0          |
| `@tanstack/react-router`      | 1.170.46         |
| `@types/node`                 | 24.19.2          |
| `@types/react`                | 19.3.0           |
| `@types/react-dom`            | 19.3.0           |
| `@vitejs/plugin-react`        | 6.1.2            |
| `axios`                       | 1.21.0           |
| `class-variance-authority`    | 0.7.1            |
| `clsx`                        | 2.1.1            |
| `eslint`                      | 10.13.0          |
| `eslint-plugin-react-hooks`   | 7.1.1            |
| `eslint-plugin-react-refresh` | 0.5.7            |
| `globals`                     | 17.13.0          |
| `msw`                         | 2.15.0           |
| `prettier`                    | 3.9.10           |
| `react`                       | 19.3.1           |
| `react-dom`                   | 19.3.1           |
| `socket.io-client`            | 4.8.4            |
| `tailwind-merge`              | 3.7.0            |
| `tailwindcss`                 | 4.3.3            |
| `typescript`                  | 5.9.3            |
| `typescript-eslint`           | 8.72.1           |
| `vite`                        | 8.3.5            |

## Compatibilidade e limitações

`@mswjs/socket.io-binding@0.2.0` exige MSW `^2.10.2`; MSW 2.15.0 atende a essa dependência par. Sua dependência de desenvolvimento publicada usa cliente Socket.IO `^4.8.1`, compatível com a versão escolhida 4.8.4. A integração usa analisador Engine.IO 5 e analisador Socket.IO 4. Isso estabelece somente compatibilidade entre pacotes. Um teste posterior de protocolo no navegador deve verificar transporte WebSocket, negociação inicial, codificação de eventos, desconexão e reconexão do cliente pelo MSW. Não se presume suporte a long-polling. Nenhuma conexão de socket foi criada na inicialização.

O Lighthouse CI mais recente, 0.15.1, traz avisos transitivos de ferramentas de desenvolvimento: `npm audit` informa 16, sendo 13 de gravidade alta, 1 moderada e 2 baixas, todos na cadeia do Lighthouse CI. Não foram aplicadas redução forçada de versão ou sobrescritas transitivas entre versões principais. Permanecem como limitação das ferramentas a ser revista antes de atualizações ou aceitação de entradas de auditoria não confiáveis; essas dependências não são importadas pela aplicação. O postinstall do pacote MSW é ignorado pela política de aprovação de scripts do npm 11; a geração explícita do worker funcionou e a inicialização no navegador foi verificada.

## Limites e exclusões

Configurados provedor Query, roteador em código com tipos registrados, instância Axios com ambiente validado e timeout finito, worker MSW vazio carregado dinamicamente e aguardado, aliases/utilitários Tailwind/shadcn, testes Chromium desktop/mobile, Lighthouse CI sobre build otimizado e configuração SPA Vercel com prioridade para arquivos existentes.

Sem catálogo, detalhe de NFT, carrinho, checkout, conta/autenticação, perfil, carteira, favoritos, pedidos, modelos de domínio, contratos, endpoints REST, massas de dados, persistência, validação de negócio, cenários de rede, eventos Socket.IO, integrações externas, navegação de produto ou reprodução de design. As restrições futuras de arquitetura estão registradas em `ARCHITECTURE.md`.

## Referências oficiais consultadas

- [Configuração e requisitos de execução do Vite](https://vite.dev/guide/)
- [Ciclo de vida das versões do Node](https://nodejs.org/en/about/previous-releases)
- [Início rápido do TanStack Router](https://tanstack.com/router/latest/docs/quick-start)
- [Integração Vite do Tailwind](https://tailwindcss.com/docs/installation/using-vite)
- [Configuração manual do shadcn](https://ui.shadcn.com/docs/installation/manual)
- [Integração do MSW no navegador](https://mswjs.io/guides/integrations/browser)
- [Código-fonte da integração Socket.IO](https://github.com/mswjs/socket.io-binding)
- [Configuração do Playwright](https://playwright.dev/docs/test-configuration)
- [Configuração do Lighthouse CI](https://googlechrome.github.io/lighthouse-ci/docs/configuration.html)

Os manifestos do registro de pacotes também foram consultados para versões resolvidas e requisitos de dependências pares. O README local fornecido para o desafio foi tratado como referência e preservado integralmente em `docs/challenge-requirements.md`.

## Verificação

Todas as observações de navegador/auditoria foram executadas pelo agente; não se declara aprovação visual humana.

| Verificação                           | Resultado                                                                                                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                              | Aprovada com o arquivo de lock pronto para versionamento; permanecem os avisos acima                                                                                            |
| `npm run typecheck` / `npm run build` | Aprovados, incluindo builds otimizados padrão e `--mode mocks`                                                                                                                  |
| `npm run lint`                        | Aprovado com ESLint 10 e nenhum aviso                                                                                                                                           |
| `npm run format:check`                | Aprovado                                                                                                                                                                        |
| `npm run test:e2e`                    | Dois testes aprovados por modo de mocks, desktop de 1440px e mobile de 390px                                                                                                    |
| Inspeção do worker e roteamento       | O controlador habilitado aponta para `/mockServiceWorker.js`; o arquivo do worker responde 200 com `text/javascript`; o fallback de acesso direto a rota desconhecida renderiza |
| Revisão de capturas de tela           | O agente inspecionou capturas desktop/mobile; o texto é legível, centralizado e quebra de linha sem transbordamento horizontal                                                  |
| Revisão da execução/código            | Não foram observados tráfego REST/Socket.IO, erros de console/página, handlers de negócio ou funcionalidades implementadas                                                      |
| `npm run audit:lighthouse`            | Aprovado; três relatórios HTML e JSON por perfil mantidos localmente em `reports/lighthouse`                                                                                    |
| Ações remotas                         | Nenhuma implantação, alteração de repositório remoto ou push                                                                                                                    |

O ambiente restrito impediu acesso DNS do npm (`EAI_AGAIN`) e abertura da porta do servidor local (`listen EPERM 127.0.0.1:4173`). Instalação pela rede, execução do navegador e servidores locais de auditoria funcionaram com permissões ampliadas. Uma tentativa prematura de teste se sobrepôs à reinstalação de dependências e foi descartada; após a conclusão da instalação, builds e verificações no navegador passaram. O `mktemp` deste ambiente produziu diretórios de perfil Lighthouse com estilo Windows na árvore de trabalho; esses perfis gerados foram removidos após a conclusão da auditoria.

Medianas por categoria exclusivas da inicialização (desempenho / acessibilidade / boas práticas / SEO): mobile **98 / 100 / 96 / 91**; desktop **100 / 100 / 96 / 91**. Ambiente: Linux x86_64, Node 24.22.0, Lighthouse CI 0.15.1 com Lighthouse 12.6.1, Headless Chromium 156 gerenciado pelo Playwright, build otimizado em localhost com mocks habilitados, limitação simulada padrão mobile do Lighthouse e configuração desktop, respectivamente. São medições da tela provisória e não demonstram desempenho do marketplace. Nenhum token ou serviço de envio foi configurado; os relatórios usam saída local no sistema de arquivos.

O `dist/` local final foi gerado novamente com mocks desabilitados. O roteamento Vercel com prioridade para arquivos está preparado, mas não pode ser verificado na plataforma sem uma implantação posterior autorizada. A verificação do protocolo Socket.IO e as funcionalidades do marketplace permanecem adiadas.
