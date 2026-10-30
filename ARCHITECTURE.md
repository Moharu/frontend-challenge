# Arquitetura

Estado final da entrega: descoberta pública, carrinho (visitante e conta), cadastro, login e sessão, checkout (carteiras, conexão simulada e cotação), pedidos (criação idempotente, pagamento simulado, `order.updated` privado e recibo) e conta (perfil, avatar, senha, carteiras principal e secundária e favoritos otimistas), sobre REST com Axios, TanStack Query, TanStack Router, MSW e Socket.IO simulado. Publicado na Vercel ([implantação](docs/deploy-verification.md)). Fora do escopo: histórico de pedidos, recuperação de senha, login social e páginas editoriais.

## Inicialização e build

`main.tsx` valida o ambiente, configura a única instância Axios e aguarda o estado persistido e o MSW (com o worker controlando a página) antes de renderizar React em Strict Mode. Sem service worker, a página explica que a demonstração depende dele. Mocks são o padrão desta demonstração sem backend real; desabilitá-los exige uma API compatível e não cria caminhos alternativos de negócio no cliente. No build com mocks, o plugin `kurio-preload-mocks` (`vite.config.ts`) faz `modulepreload` do chunk do MSW. A ponte de testes (`src/testing/harness.ts`) só entra no build de integração (`VITE_ENABLE_TEST_HARNESS`).

## Rotas

`app/router.tsx` define `/` (início/catálogo), `/nfts/$nftId`, `/cart`, `/checkout` (`?step=dados|carteira|revisao` no mobile), `/orders/$orderId`, `/account/*` e `/login` / `/signup` (diálogo sobre a página atual), com tipos registrados no TanStack Router e rotas lazy. As privadas usam `requireSession` (`lib/route-guards.ts`); o destino de retorno trafega em `redirect`, validado contra redirecionamento aberto (`lib/redirect.ts`). A busca do catálogo é validada e normalizada por `lib/discovery-search.ts` e é a única fonte do estado de filtros: busca, filtros, modo e ordenação voltam à página 1. Rota inexistente e NFT ausente têm páginas distintas.

## Contratos REST e eventos

`contracts/` mantém tipos de transporte independentes de frameworks, com validadores explícitos, compartilhados pelos handlers MSW e pela interface: NFTs, carrinho, sessão, carteiras e conexões, cotação, dados do colecionador, pedidos, perfil e favoritos. `eth.ts` faz toda a aritmética em `bigint` (10^-18 ETH), com valores trafegando como strings decimais. O envelope de erro é `{ error: { code, message, fields?, retryable } }`, com 400, 401 (`SESSION_INVALID`, `INVALID_CREDENTIALS`, `VISITOR_INVALID`), 403, 404, 409 (`CONFLICT`, `QUOTE_CHANGED`, `ORDER_PENDING`), 503 e falha de rede. Pedidos aceitam `Idempotency-Key`: a mesma chave e o mesmo corpo devolvem o mesmo pedido; a mesma chave com outro corpo é 409.

Eventos: `nft.updated` (público) e `order.updated` (privado, só para as conexões do dono, com a sessão conferida de novo a cada entrega), com `eventId`, recurso e versão. Detalhes em [REST](docs/contracts/rest.md) e [eventos](docs/contracts/events.md).

## Política de sessão

`data/session/identity.ts` é a fonte da identidade (token de sessão, sessão verificada, token de visitante e estado). Só tokens opacos ficam em localStorage. A sessão é verificada com `GET /session` sem bloquear as páginas públicas e vale 7 dias. Um 401 `SESSION_INVALID` com o token atual dispara o fluxo de expiração: aviso, login e retorno ao mesmo lugar, preservando o rascunho do checkout e a tentativa de pedido não resolvida. Logout e troca de usuário publicam a nova identidade antes de cancelar requisições privadas, removem os caches de outros escopos, liberam os ouvintes privados do socket e descartam rascunhos. Mutations privadas são enviadas com a identidade que as iniciou e param quando ela muda. Política completa em [sessão](docs/session.md).

## Estado do carrinho

O carrinho é do servidor simulado: visitante (`X-Visitor-Token`, emitido na primeira mutation) ou conta (sessão). No login e no cadastro, o carrinho do visitante é mesclado no da conta, sem reduzir quantidades em silêncio. A chave `['cart', escopo]` inclui usuário e geração (ou o token do visitante); uma única regra (`keepNewestCart`) impede que uma versão menor substitua a atual, em leituras e em respostas de mutation. Valores (subtotal, desconto, taxa e total) vêm da API; a interface só exibe. Detalhes em [carrinho](docs/cart.md).

## Estratégia de cache

- Chaves normalizadas e completas: a busca do catálogo inteira, o identificador do NFT e, nos dados privados, `[recurso, escopo]` com usuário e geração (carrinho, carteiras, perfil, favoritos, pedido).
- Dados públicos ficam imediatamente desatualizados (`staleTime` 0) e são revalidados ao montar e pelos eventos; respostas antigas são descartadas por `AbortSignal` (Axios) e pelas chaves.
- Sem retry automático: falhas mostram erro com "Tentar novamente", e conteúdo útil é mantido durante atualizações em segundo plano (`keepPreviousData` no catálogo).
- Invalidação após mutations e eventos: `nft.updated` grava o detalhe mais recente e invalida listas, relacionados e o carrinho que contém o NFT; mutations do carrinho gravam a resposta da API; favoritos usam atualização otimista com reversão e reconciliação ao fim.
- Pedido: `['order', escopo, id]` com a regra `newerOrder` (nunca versão menor, nunca sai de um estado terminal).

## Reconciliação entre REST e Socket.IO

`PublicLayout` é o único dono da conexão: carrega o Socket.IO depois do MSW (a integração precisa interceptar o WebSocket), autentica a conexão com `session.authenticate` e a descarta ao desmontar. `realtime/catalog.ts` valida envelopes, deduplica por `eventId` e versão, nunca regride um estado mais recente e, a cada (re)conexão, invalida por REST todos os recursos ativos (detalhes, listas, relacionados, carrinho e pedido). Eventos nunca são a única fonte: o checkout revalida a cotação ao confirmar, e o pedido é sempre relido por REST após reconectar ou recarregar. O transporte é WebSocket com namespace padrão e heartbeat, sem servidor externo; limitações da integração em [eventos](docs/contracts/events.md).

## Servidor simulado (MSW)

`mocks/store` mantém um retrato em memória e em localStorage (`kurio.mock.catalog.v1`, `schemaVersion` 7), com fila serializada de leituras e escritas, gravação antes da emissão de eventos e reset para a seed. Senhas guardam só sal e hash PBKDF2. `mocks/handlers.ts` implementa as rotas do contrato (as demais respondem 501); `mocks/scenarios.ts` controla cenários nomeados, atrasos e falhas de uso único; `mocks/socket.ts` é o servidor Socket.IO simulado. Os controles ficam só na ponte do build de integração. Cenários em [mocks](docs/mock-scenarios.md).

## Componentes e estilos

`components/discovery/layout.tsx` compõe cabeçalho, navegação mobile e rodapé. `components/ui` adapta Button (cva/cn) e Dialog (Radix) no padrão shadcn (`components.json`) à identidade KURIO; as abas do detalhe usam o primitivo Radix Tabs. Tailwind CSS v4 entra pelo plugin do Vite (`@import "tailwindcss"`, tokens em `@theme`, camada `base`). Layout, espaçamento, tipografia, cores e responsividade de cada elemento são classes utilitárias no próprio `className`, com valores exatos do Figma (`gap-[14px]`, `text-[color:var(--muted-foreground)]`) e variantes de breakpoint (`max-[701px]:` equivale a `max-width: 700px`; `min-[701px]:`). O nome semântico da classe continua no elemento (testes e seletores dependem dele). `styles/globals.css` mantém o que não se expressa bem em utilitários: tokens, Roboto Mono local, seletores de descendentes e de estado, máscaras, sombras, animações (shimmer e movimento reduzido) e propriedades compartilhadas por mais de uma classe no mesmo elemento, que o CSS sem camada decide pela ordem. Artes WebP responsivas derivam dos PNG do Figma (`docs/figma-assets.json`). Acessibilidade em [acessibilidade](docs/accessibility.md).

## Testes e verificação

`npm test` roda os dois builds e as duas suítes Playwright: o E2E no build normal (ausência da ponte, referências visuais) e a integração no build com a ponte (fluxos, falhas, tempo real, acessibilidade com axe). Mapa dos 12 grupos em [testes](docs/testing.md); requisitos lado a lado em [rastreabilidade](docs/requirements-traceability.md); Lighthouse em [desempenho](docs/performance.md).

## Decisões de UX

- Login e cadastro abrem como diálogo sobre a página atual (que continua igual atrás) e voltam ao fluxo anterior.
- O pedido é uma página, não um modal, para sobreviver a refresh, ter link direto e retomar depois do login.
- Um único "Salvar" no perfil, com resultado por parte (dados, avatar, senha) e sem sucesso geral quando algo falhou.
- Ações fora do escopo usam um diálogo de indisponibilidade ou uma página honesta, nunca um falso sucesso.
- Favoritar deslogado leva ao login sem aplicar a intenção depois (evita aplicá-la em outra conta).
- Mudanças de valores no checkout exigem nova confirmação; valores iguais com cotação renovada seguem sem pedir de novo.

## Desvios do Figma

Uma linha por desvio, com o documento da decisão.

| Tela             | Desvio                                                                                                        | Decisão                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Descoberta       | Edições, preços, IDs, raridade e totais vêm da API; não se copia a repetição de `1/10` nem valores do desenho | [descoberta](docs/discovery.md#design-recursos-e-desvios)       |
| Descoberta       | Contrato, padrão do token e royalty com rótulos corretos (troca aparente no layout)                           | [descoberta](docs/discovery.md#design-recursos-e-desvios)       |
| Descoberta       | Paginação e ordenação acessíveis no mobile; drawer mobile como rascunho, com Aplicar/Cancelar/Limpar          | [descoberta](docs/discovery.md#design-recursos-e-desvios)       |
| Descoberta       | Barra lateral: coleção, rede e "Limpar filtros" aplicam ao clicar; Aplicar só para a faixa de preço           | [descoberta](docs/discovery.md#design-recursos-e-desvios)       |
| Descoberta       | Detalhe mobile sem ação de carrinho separada (só Comprar e Favoritar, por decisão do usuário)                 | [carrinho](docs/cart.md#design-e-desvios-do-figma)              |
| Descoberta       | Busca do cabeçalho desktop expande inline; no mobile o formulário fica visível                                | [descoberta](docs/discovery.md#design-recursos-e-desvios)       |
| Descoberta       | Navegação inferior só no início; no detalhe mobile, a área inferior é de quantidade, preço e ações            | [descoberta](docs/discovery.md#design-recursos-e-desvios)       |
| Descoberta       | Blocos editoriais e rodapé em fluxo natural no mobile; alturas podem crescer com o texto real                 | [descoberta](docs/discovery.md#design-recursos-e-desvios)       |
| Carrinho         | Linha desktop mostra a edição ("Edição: 1/20"), um pouco mais alta                                            | [carrinho](docs/cart.md#design-e-desvios-do-figma)              |
| Carrinho         | Mobile: lixeira no canto superior e quantidade no inferior, sem a sobreposição do card "Ivory Baron"          | [carrinho](docs/cart.md#design-e-desvios-do-figma)              |
| Carrinho         | "Desconto do lançamento" vira "Desconto (código)"; "Taxa estimada (Ethereum)"                                 | [carrinho](docs/cart.md#design-e-desvios-do-figma)              |
| Carrinho         | Resumo fixo mobile reserva sua altura e limita-se a 70% da tela                                               | [carrinho](docs/cart.md#design-e-desvios-do-figma)              |
| Carrinho         | 768px: tabela desktop com o resumo abaixo                                                                     | [carrinho](docs/cart.md#design-e-desvios-do-figma)              |
| Carrinho         | Desktop: título "Carrinho de NFTs" só para leitores de tela (a trilha é o título visível)                     | [acessibilidade](docs/accessibility.md)                         |
| Login e cadastro | "Voltar" acrescentado no mobile; fundo do modal sutil, sem escurecimento forte                                | [sessão](docs/session.md#desvios-do-figma-e-indisponibilidades) |
| Login e cadastro | Rótulos ocultos associados a cada campo; placeholder do e-mail "Digite seu e-mail"                            | [sessão](docs/session.md#desvios-do-figma-e-indisponibilidades) |
| Login e cadastro | Mostrar/ocultar também em "Confirmar senha"; regras de username e senha visíveis antes do envio               | [sessão](docs/session.md#desvios-do-figma-e-indisponibilidades) |
| Login e cadastro | Link de alternância (Entrar/Criar conta) sublinhado no mobile                                                 | [acessibilidade](docs/accessibility.md)                         |
| Pagamento        | Asteriscos só nos campos obrigatórios pelo contrato; "(opcional)" só no placeholder                           | [checkout](docs/checkout.md#decisões-e-desvios-do-figma)        |
| Pagamento        | "Nome ENS" como lista dos nomes das carteiras; regras de formato só no erro                                   | [checkout](docs/checkout.md#decisões-e-desvios-do-figma)        |
| Pagamento        | Rede, tipo e endereço somente leitura, vindos da carteira; provedores seguem a carteira cadastrada            | [checkout](docs/checkout.md#decisões-e-desvios-do-figma)        |
| Pagamento        | Legenda da taxa com a rede efetiva; resumo completo no passo de revisão mobile                                | [checkout](docs/checkout.md#decisões-e-desvios-do-figma)        |
| Pagamento        | Ícones dos provedores com a inicial (o arquivo não exportou os ícones); avisos no topo no mobile              | [checkout](docs/checkout.md#decisões-e-desvios-do-figma)        |
| Pagamento        | Cabeçalho autenticado em vez de "Entrar"; passos de dados e revisão mobile seguem o passo da carteira         | [checkout](docs/checkout.md#decisões-e-desvios-do-figma)        |
| Confirmação      | Página em vez de modal; mobile em tela cheia                                                                  | [pedidos](docs/orders.md#decisões-e-desvios-do-figma)           |
| Confirmação      | Estados pendente e recusado (sem frame) seguem o cartão do recibo; recibo com tabela de itens e subtotal      | [pedidos](docs/orders.md#decisões-e-desvios-do-figma)           |
| Confirmação      | Ilustração "THANK YOU" redesenhada em SVG (asset não exportado); data no formato pt-BR                        | [pedidos](docs/orders.md#decisões-e-desvios-do-figma)           |
| Conta            | Asteriscos pelo contrato; ícones da barra lateral redesenhados (não exportados)                               | [conta](docs/account.md#decisões-e-desvios-do-figma)            |
| Conta            | "Igual à carteira principal" é uma ação de preenchimento; sem avatar no cabeçalho                             | [conta](docs/account.md#decisões-e-desvios-do-figma)            |
| Conta            | Mobile sem frames: coluna única e menu "Meu perfil" sobreposto; sem rodapé nas páginas da conta               | [conta](docs/account.md#rotas-e-navegação)                      |

A revisão de fidelidade visual com o Figma foi feita e aprovada pelo usuário; os ajustes que ela gerou estão em [verificação final](docs/final-verification.md#contraste-768-px-e-ajustes-de-figma) e o status em [rastreabilidade](docs/requirements-traceability.md).

## Limitações

- **Rede de pagamento independente da rede do NFT (simplificação deliberada).** Qualquer carteira paga o pedido inteiro na rede dela. Numa integração real, `POST /quotes` e `POST /orders` rejeitariam itens incompatíveis com a rede da carteira, e o checkout filtraria as carteiras ou dividiria o pedido.
- **Token de sessão acessível ao JavaScript (simplificação da simulação).** Em produção seria um cookie `HttpOnly`, `Secure` e `SameSite`.
- Comprar no detalhe (que adiciona ao carrinho) não reserva estoque; só a criação do pedido reserva (liberado na recusa).
- Estado simulado entre abas: adoção do retrato mais recente por contador lógico, sem notificação ativa; duas gravações no mesmo `tick` resolvem por última gravação.
- Requisições `/api` feitas por uma página no instante em que ela é descartada (recarga ou navegação completa) saem do service worker e recebem 404 na Vercel; não afetam a página nova ([implantação](docs/deploy-verification.md)).
- Escape pressionado no login antes de o aviso de indisponibilidade terminar de abrir fecha os dois diálogos (o Radix só encaminha o Escape a uma camada depois de montá-la); com o aviso aberto, o Escape fecha só ele.
- Desempenho mobile no limite da meta (92 na URL publicada); a referência local fica abaixo ([desempenho](docs/performance.md)).
- Leitor de tela: os nomes, marcos e regiões de status foram revisados por axe e pelos testes; não houve passada manual com leitor de tela ([acessibilidade](docs/accessibility.md)).

Detalhes: [descoberta](docs/discovery.md), [carrinho](docs/cart.md), [sessão](docs/session.md), [checkout](docs/checkout.md), [pedidos](docs/orders.md), [conta](docs/account.md), [cenários](docs/mock-scenarios.md), [REST](docs/contracts/rest.md), [eventos](docs/contracts/events.md), [testes](docs/testing.md), [acessibilidade](docs/accessibility.md), [desempenho](docs/performance.md) e [rastreabilidade](docs/requirements-traceability.md).
