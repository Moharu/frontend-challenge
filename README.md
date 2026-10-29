# Desafio frontend KURIO

Base de dados: uma tela provisória acessível com contratos tipados, mocks determinísticos e persistidos de NFTs e infraestrutura REST/Socket.IO verificada. As telas do marketplace e os comportamentos de compra e conta não estão implementados. Os requisitos originais estão preservados em [docs/challenge-requirements.md](docs/challenge-requirements.md).

Use Node 24.22.0 (`nvm use`) e npm 11.

```sh
npm ci
cp .env.example .env.local
npx playwright install chromium
npm run dev
```

No Windows, copie `.env.example` para `.env.local` pelo terminal ou editor. Se o Chromium precisar de bibliotecas do sistema no Linux, execute `npx playwright install --with-deps chromium` com as permissões de sistema necessárias.

| Script                            | Finalidade                                                    |
| --------------------------------- | ------------------------------------------------------------- |
| `dev`                             | Servidor de desenvolvimento                                   |
| `dev:mocks`                       | Desenvolvimento com mocks habilitados pelo modo mocks do Vite |
| `build`                           | Verificação de tipos e build otimizado                        |
| `preview`                         | Servir o build localmente                                     |
| `typecheck`                       | Tipos da aplicação, configurações e testes                    |
| `lint`                            | ESLint, sem avisos                                            |
| `format` / `format:check`         | Formatar / verificar a formatação dos arquivos mantidos       |
| `test:e2e`                        | Testes básicos no Chromium desktop (1440px) e mobile (390px)  |
| `test:e2e:ui` / `test:e2e:report` | Executor interativo / relatório HTML                          |
| `audit:lighthouse`                | Três execuções do build otimizado por perfil mobile/desktop   |

Execute `npm run build` antes dos testes E2E e do Lighthouse. Os testes gerenciam o próprio servidor de pré-visualização. Para verificar a inicialização otimizada com mocks, execute `npm run build -- --mode mocks` e depois `npm run test:e2e`. Gere novamente o build normal para testar a configuração padrão, com mocks desabilitados.

`VITE_API_BASE_URL` usa `/api` por padrão; informe um caminho relativo à raiz ou uma URL HTTP(S) absoluta. `VITE_ENABLE_MOCKS` aceita exatamente `true` ou `false` e usa `false` por padrão. Todas as configurações `VITE_*` são valores públicos definidos durante o build, nunca segredos. `.env.local` ou o ambiente do processo sobrescrevem os padrões do modo; mantenha-os ausentes ou consistentes ao testar os modos. Para a futura demonstração na Vercel, defina `VITE_ENABLE_MOCKS=true` antes do build.

Os mocks são carregados dinamicamente e sua inicialização é aguardada antes da renderização, inclusive em builds otimizados. O estado do catálogo é inicializado pelo localStorage com chave própria antes de a interceptação de requisições e sockets ficar pronta. Somente os endpoints de listagem/detalhe de NFT e os eventos públicos de catálogo estão implementados; endpoints de API não suportados retornam erros JSON. A tela provisória nunca os chama. Gere novamente o worker versionado após atualizações do MSW com `npx msw init public --save`.

Execute as verificações isoladas e otimizadas do protocolo com `npm run build:integration`, seguido de `npm run test:integration`. Esse modo explícito de teste habilita uma estrutura de testes não visual no navegador e gera o build em `dist-integration/`; os builds normais a excluem. Consulte os [contratos REST](docs/contracts/rest.md), [eventos](docs/contracts/events.md) e [cenários de mocks](docs/mock-scenarios.md) para conhecer as massas de dados, controles de restauração, política de persistência, comportamento das consultas e limites verificados do transporte. Endpoints definidos apenas em contrato não implementam comportamentos de conta ou compra. Nenhuma dependência adicional foi necessária.

O Lighthouse grava HTML/JSON em `reports/lighthouse/{mobile,desktop}`. Esses artefatos ignorados pelo Git descrevem **somente a tela provisória da inicialização**. O relatório final deve usar a mediana de cada categoria entre três execuções, e não as notas de uma execução representativa. Metas do marketplace: desempenho 90, acessibilidade 95, boas práticas 95 e SEO 90; registre LCP, CLS e TBT para início e detalhe do NFT após a implementação. O único alvo atual é `/`.

`vercel.json` prepara a saída do Vite e o fallback da SPA com prioridade para arquivos existentes, mantendo `/mockServiceWorker.js` e os recursos estáticos acessíveis. Nenhum projeto Vercel está vinculado e nenhuma implantação foi realizada.

Consulte [ARCHITECTURE.md](ARCHITECTURE.md), o [escopo da inicialização](docs/bootstrap-scope.md) e o [diário de acompanhamento](docs/ai-interaction-journal.md).

Toda a documentação do projeto deve ser mantida em português do Brasil (pt-BR).
