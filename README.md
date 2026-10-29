# Desafio frontend KURIO

Descoberta pública de NFTs, carrinho e conta: início/catálogo, detalhe e carrinho responsivos, com busca, filtros, modos, paginação, galeria, seleção de edição/quantidade, carrinho persistido no servidor simulado com cupons e resumo calculado pela API, atualizações públicas em tempo real, cadastro, login, logout e sessão com mesclagem do carrinho de visitante. REST, persistência e Socket.IO são simulados na camada de rede com MSW. Favoritos persistidos, checkout, cotação, pedidos, perfil e carteiras ainda não estão implementados.

Os requisitos originais estão em [docs/challenge-requirements.md](docs/challenge-requirements.md), preservados sem alterações.

Use Node 24.22.0 (`nvm use`) e npm 11.

```sh
npm ci
cp .env.example .env.local
npx playwright install chromium
npm run dev:mocks
```

No Windows, copie `.env.example` pelo terminal ou editor. No Linux, se faltarem bibliotecas de sistema do navegador, use `npx playwright install --with-deps chromium` com as permissões necessárias.

| Script                            | Finalidade                                                                                   |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| `dev` / `dev:mocks`               | Desenvolvimento / desenvolvimento com mocks explicitamente habilitados                       |
| `build` / `preview`               | Tipos e build otimizado / pré-visualização local                                             |
| `typecheck`                       | Tipos da aplicação, configuração e testes                                                    |
| `lint`                            | ESLint sem avisos                                                                            |
| `format` / `format:check`         | Formatar / verificar arquivos mantidos                                                       |
| `test:e2e`                        | Fluxo básico e regressão visual de início/detalhe/carrinho em desktop/mobile no build normal |
| `test:e2e:ui` / `test:e2e:report` | Executor interativo / relatório HTML E2E                                                     |
| `build:integration`               | Build otimizado com ponte de testes isolada em dist-integration                              |
| `test:integration`                | Aritmética ETH, infraestrutura, descoberta, carrinho e sessão desktop/mobile (integração)    |
| `audit:lighthouse`                | Três medições de início/detalhe por perfil mobile/desktop                                    |

Execute `npm run build` antes de E2E e Lighthouse; para integração, execute primeiro `npm run build:integration`. Os testes gerenciam seus próprios servidores locais. Referências visuais são versionáveis e devem ser inspecionadas antes de atualização.

`VITE_API_BASE_URL` usa `/api` por padrão. `VITE_ENABLE_MOCKS` aceita exatamente `true`/`false` e agora usa `true` por padrão: sem backend real, a demonstração depende dos mocks. Desabilitá-los exige uma API compatível; não há dados fictícios alternativos no cliente. `VITE_ENABLE_TEST_HARNESS=true` pertence exclusivamente ao modo integration e nunca deve ser usado na demonstração pública. `.env.local` e variáveis do processo sobrescrevem padrões do modo. Todos os `VITE_*` são públicos e definidos no build; nunca incluir segredos.

Mocks inicializam o estado persistido antes da renderização. Carrinho e sessão são implementados; demais dados de conta/compra retornam 501. Para atualizar o worker após mudança do MSW: `npx msw init public --save`. A persistência usa somente a chave própria de catálogo e não oferece consistência entre abas.

Arte e ícones são locais, obtidos do Figma autorizado; fonte Roboto Mono é local. Veja [descoberta pública](docs/discovery.md) para rotas, modos, seed 2, assets, desvios do desenho, limitações temporárias, ciclo de vida do socket e comandos de testes. Os relatórios Lighthouse completos ficam em `reports/lighthouse`; resultados desta etapa e métricas estão em [verificação da descoberta](docs/discovery-verification.md).

## Dados de demonstração

Cupons do carrinho (validade pelo relógio lógico da simulação):

| Código       | Efeito                                  |
| ------------ | --------------------------------------- |
| `KURIO10`    | 10% de desconto no subtotal             |
| `LANCAMENTO` | 0.1 ETH de desconto, até o subtotal     |
| `KURIO15`    | Expirado (demonstra a mensagem de erro) |

Contas fictícias (credenciais de demonstração, sem valor fora desta simulação):

| Conta         | E-mail             | Senha          |
| ------------- | ------------------ | -------------- |
| `ada_example` | `ada@example.test` | `AdaKurio2026` |
| `lin_example` | `lin@example.test` | `LinKurio2026` |

A seed guarda apenas sal e hash PBKDF2. Para redefinir tudo (contas criadas, sessões e carrinhos), remova do localStorage `kurio.mock.catalog.v1`, `kurio.session.v1` e `kurio.visitor.v1`. Regras do carrinho em [carrinho](docs/cart.md); política de sessão, retorno ao fluxo e mesclagem em [sessão](docs/session.md).

Consulte [arquitetura](ARCHITECTURE.md), [contratos REST e acompanhamento](docs/contracts/rest.md), [eventos](docs/contracts/events.md), [cenários de mocks](docs/mock-scenarios.md) e [diário](docs/ai-interaction-journal.md). Orientações das etapas ficam em `docs/handoffs/`.

`vercel.json` mantém a preparação para SPA com prioridade para arquivos existentes. Nenhum projeto foi vinculado ou implantado. Toda a documentação é mantida em pt-BR.
