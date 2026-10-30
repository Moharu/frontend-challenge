# Desafio frontend KURIO

Descoberta pública de NFTs, carrinho e conta: início/catálogo, detalhe e carrinho responsivos, com busca, filtros, modos, paginação, galeria, seleção de edição/quantidade, carrinho persistido no servidor simulado com cupons e resumo calculado pela API, atualizações públicas em tempo real, cadastro, login, logout e sessão com mesclagem do carrinho de visitante, checkout (carteiras cadastradas com conexão simulada e cotação pela API) pedidos idempotentes com pagamento simulado, acompanhamento em tempo real privado e recibo, e a conta do colecionador (perfil com avatar e troca de senha, carteiras principal e secundária, favoritos com atualização otimista e "Lista de interesse"). REST, persistência e Socket.IO são simulados na camada de rede com MSW. Histórico de pedidos ainda não está implementado.

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
| `lint`                            | ESLint sem avisos e `check:bom` (falha com arquivo versionado iniciado por BOM UTF-8)        |
| `format` / `format:check`         | Formatar / verificar arquivos mantidos                                                       |
| `test:e2e`                        | Fluxo básico e regressão visual de início/detalhe/carrinho em desktop/mobile no build normal |
| `test:e2e:ui` / `test:e2e:report` | Executor interativo / relatório HTML E2E                                                     |
| `build:integration`               | Build otimizado com ponte de testes isolada em dist-integration                              |
| `test:integration`                | ETH, infraestrutura, descoberta, carrinho, sessão, checkout, pedidos e conta (integração)    |
| `audit:lighthouse`                | Três medições de início/detalhe por perfil mobile/desktop                                    |

Execute `npm run build` antes de E2E e Lighthouse; para integração, execute primeiro `npm run build:integration`. Os testes gerenciam seus próprios servidores locais. As duas configurações do Playwright usam **2 workers** por padrão: com Chromium em paralelo sem limite, o navegador caiu ("Target crashed") e o editor travou sob WSL. Com folga de memória, sobrescreva com `PW_WORKERS=4 npm run test:integration` ou `npm run test:integration -- --workers=4`. Referências visuais são versionáveis e devem ser inspecionadas antes de atualização.

`VITE_API_BASE_URL` usa `/api` por padrão. `VITE_ENABLE_MOCKS` aceita exatamente `true`/`false` e agora usa `true` por padrão: sem backend real, a demonstração depende dos mocks. Desabilitá-los exige uma API compatível; não há dados fictícios alternativos no cliente. `VITE_ENABLE_TEST_HARNESS=true` pertence exclusivamente ao modo integration e nunca deve ser usado na demonstração pública. `.env.local` e variáveis do processo sobrescrevem padrões do modo. Todos os `VITE_*` são públicos e definidos no build; nunca incluir segredos.

Mocks inicializam o estado persistido antes da renderização. Carrinho, sessão, carteiras (leitura e cadastro), conexão simulada, cotação, pedidos, perfil e favoritos são implementados; caminhos fora do contrato retornam 501. Para atualizar o worker após mudança do MSW: `npx msw init public --save`. A persistência usa somente a chave própria de catálogo e não oferece consistência entre abas.

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

A seed guarda apenas sal e hash PBKDF2. Para redefinir tudo (contas criadas, sessões e carrinhos), remova do localStorage `kurio.mock.catalog.v1`, `kurio.session.v1` e `kurio.visitor.v1`. Regras do carrinho em [carrinho](docs/cart.md); política de sessão, retorno ao fluxo e mesclagem em [sessão](docs/session.md); pagamento, carteiras, conexão simulada e cotação em [checkout](docs/checkout.md).

Carteiras de demonstração: `ada_example` tem "Principal" (Ethereum, MetaMask) e "Reserva" (Polygon, Coinbase Wallet, `nova.kurio.eth`); `lin_example` começa sem carteiras, para testar o cadastro no checkout. A conexão de carteira é simulada (não usa extensão do navegador).

Pedidos: "Confirmar compra" cria o pedido e abre `/orders/<id>`; o pagamento simulado é aprovado em cerca de 1,5s, o carrinho perde só o que foi comprado e o recibo fica disponível na mesma página. A página pode ser recarregada ou deixada e retomada. Para reproduzir uma **recusa** ou um **timeout depois da criação**, use o build de integração e chame no console `__KURIO_TEST__.setPayment("declined")` ou `__KURIO_TEST__.loseNextOrderResponse()` antes de confirmar (ver [cenários](docs/mock-scenarios.md#extensões-da-etapa-de-pedidos)). Regras em [pedidos](docs/orders.md) e evidências em [verificação dos pedidos](docs/orders-verification.md).

Conta: o menu da conta no cabeçalho (ou "Minha conta" no mobile) leva a `/account` (Dados do perfil, Carteiras, Lista de interesse; Atividade, Ofertas, Arquivos baixados e Suporte informam que não estão disponíveis). Cada usuário tem no máximo uma carteira principal e uma secundária. O coração dos cartões e do detalhe favorita de verdade; deslogado, leva ao login. Para ver a reversão otimista, use no build de integração `__KURIO_TEST__.failNextFavorite("http")` antes de clicar. Regras em [conta](docs/account.md) e evidências em [verificação da conta](docs/account-verification.md).

Consulte [arquitetura](ARCHITECTURE.md), [contratos REST e acompanhamento](docs/contracts/rest.md), [eventos](docs/contracts/events.md), [cenários de mocks](docs/mock-scenarios.md) e [diário](docs/ai-interaction-journal.md). Orientações das etapas ficam em `docs/handoffs/`.

`vercel.json` mantém a preparação para SPA com prioridade para arquivos existentes. Nenhum projeto foi vinculado ou implantado. Toda a documentação é mantida em pt-BR.
