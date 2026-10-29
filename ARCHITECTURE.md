# Arquitetura

Estado em relação ao commit `157f168` e à etapa de sessão: descoberta pública, carrinho (visitante e conta) e cadastro/login/sessão implementados sobre REST, Query, MSW e Socket.IO simulados. Favoritos, cotação, pedidos, perfil e carteiras continuam somente contratos.

## Inicialização e build

`main.tsx` valida o ambiente dentro de uma inicialização com tratamento de falhas, configura a única instância Axios e aguarda o estado persistido e o MSW antes de renderizar React em Strict Mode. Mocks são o padrão desta demonstração sem backend real; desabilitá-los exige uma API compatível e não cria caminhos alternativos de negócio no cliente. No build com mocks, o plugin `kurio-preload-mocks` em `vite.config.ts` adiciona `modulepreload` do chunk do MSW e de suas importações ao `index.html`.

## Rotas e estado de navegação

`app/router.tsx` define `/` (início/catálogo), `/nfts/$nftId` (detalhe, lazy), `/cart` (carrinho, lazy) e `/login` / `/signup` (lazy, diálogo sobre a página inicial), com tipos registrados no TanStack Router. O destino de retorno trafega em `redirect`, validado por `lib/redirect.ts` contra redirecionamento aberto; `lib/route-guards.ts` traz `redirectAuthenticated` e `requireSession` (para as rotas privadas futuras). A rota inicial valida e normaliza search params por `lib/discovery-search.ts`; essa saída é a entrada da Query e do Axios, e é a única fonte do estado de filtros. Formulários usam rascunhos locais e confirmam mudanças pela URL. Rota inexistente e NFT ausente têm recuperação distinta. O alias `@/` é compartilhado por TypeScript, Vite e shadcn.

## Componentes e estilos

`components/discovery/layout.tsx` (`PublicLayout`) compõe cabeçalho, navegação mobile e rodapé e é dono da conexão de tempo real. O cabeçalho desktop é fixo; Início e Mercado usam `useLinkProps` com estado ativo definido pela posição do catálogo (o roteador marcaria os dois) e preservam filtros; a busca do cabeçalho expande inline. No mobile, a barra de busca/filtros da página inicial é fixa no topo. `components/discovery/shared.tsx` traz cartões, estados e o adaptador `Unavailable`. `components/ui` adapta Button (cva/cn), Dialog e Tabs (Radix) à identidade KURIO; diálogos mantêm foco e oferecem Escape.

`styles/globals.css` centraliza tokens marrom/cobre, Roboto Mono local, composição responsiva, shimmer com movimento reduzido, hover somente em dispositivos com ponteiro e espaço para as áreas fixas por `scroll-margin-top` nos alvos (não `scroll-padding` na página, que fazia o foco dentro das áreas fixas rolar a página). Recursos locais são mapeados em `components/discovery/assets.ts` (artes WebP responsivas derivadas dos PNG do Figma); proveniência e inventário em `docs/discovery.md` e `docs/figma-assets.json`.

## Contratos

`contracts/` mantém tipos de transporte independentes de frameworks, com validadores explícitos. Implementados: NFTs (conteúdo público, edições, modos, facetas) e carrinho (`cart.ts`: token de visitante, linhas com preço atual, conflitos, mudança de preço, cupom, resumo e `isCart`). `eth.ts` faz toda a aritmética em `bigint` (unidades de 10^-18 ETH): soma, subtração com piso zero, multiplicação por inteiro, percentual em pontos-base arredondado para baixo e formatação de exibição separada. O mesmo módulo é usado pelos handlers (fonte dos valores) e pela interface (exibição). Somente contratos: sessão/conta, favoritos, cotação (sem cupom na entrada; ele vem do carrinho), pedidos com snapshots imutáveis, perfil e carteiras. O envelope de erro é `{ error: { code, message, fields?, retryable } }`, com `fields` sempre contendo mensagens legíveis.

## Dados no cliente

`lib/http.ts` mantém a instância Axios (timeout de 10 segundos). `lib/api-error.ts` converte falhas no envelope de erro para a interface.

- `data/nfts`: listagem, detalhe e relacionados com validação, AbortSignal, chaves normalizadas completas, sem retry automático e dados imediatamente desatualizados; a interface oferece nova tentativa explícita e conserva conteúdo útil durante atualizações em segundo plano.
- `data/session`: `identity.ts` é a fonte da identidade do cliente (token de sessão, sessão verificada, token de visitante e estado `checking`/`anonymous`/`authenticated`), guardando apenas tokens em localStorage com fallback em memória. Verifica a sessão guardada com `GET /session` sem bloquear a renderização, trata 401 `SESSION_INVALID` somente quando a requisição usou o token atual e, em toda troca de identidade, publica a nova identidade antes de cancelar requisições privadas e remover caches de outros escopos. `notices.ts` é o canal único de anúncios (`Notices`, `role="status"`). Política completa em `docs/session.md`.
- `data/cart`: envia `Authorization: Bearer` com sessão ou `X-Visitor-Token` sem ela (`api.ts`). O token de visitante é emitido na primeira mutation; `VISITOR_INVALID` significa apenas carrinho de visitante perdido (token descartado e aviso), nunca sessão expirada. A chave da consulta inclui o escopo (`visitor`+token ou `user`+userId+geração), e as respostas carregam o escopo em que foram pedidas. A consulta `['cart', escopo]` e as mutations (`queries.ts`, `hooks.ts`) aplicam **uma única regra**, `keepNewestCart`, tanto a leituras quanto a respostas de mutation: uma versão menor do mesmo carrinho nunca substitui a atual; versão igual é aceita (preços do catálogo mudam sem escrita no carrinho); outro `id` (novo visitante) sempre substitui. Falhas de mutation não alteram o cache.

## Servidor simulado (MSW)

`mocks/store` mantém um único retrato em memória e localStorage na chave histórica `kurio.mock.catalog.v1`, em `schemaVersion` 4 / `seedVersion` 2: catálogo, visitantes (token → carrinho), carrinhos, contas (com sal e hash PBKDF2-SHA256, nunca senha em claro), sessões (token → usuário, geração, validade, revogação) e o contador global de geração. `mocks/store/accounts.ts` concentra cadastro, login (resposta genérica e derivação mesmo para e-mail desconhecido), logout com revogação e a mesclagem única do carrinho de visitante. Retratos incompatíveis restauram somente essa chave. Todas as leituras e escritas passam por uma fila serializada; antes de cada operação o store adota o retrato persistido se o contador lógico `tick` dele for maior (política de múltiplas abas: sem notificação ativa; uma aba se atualiza na próxima leitura, inclusive ao recuperar o foco). Gravações persistem antes de emitir eventos. `mocks/store/cart.ts` concentra as regras do carrinho (linhas, conflitos sem redução silenciosa, preço reconhecido, cupons, taxa estimada e resumo); `seed.ts` traz NFTs, cupons e taxas por rede.

`mocks/handlers.ts` implementa `GET /nfts`, `/nfts/:id`, `/nfts/:id/related`, `POST /visitor-sessions`, as rotas de carrinho e cupom (`GET /cart`, `POST /cart/items`, `PATCH`/`DELETE /cart/items/:itemId`, `PUT`/`DELETE /cart/coupon`), que atendem visitante ou sessão (a sessão prevalece), e as de conta (`POST /account/register`, `POST /session/login`, `GET /session`, `POST /session/logout`). Os demais caminhos da API respondem 501 `NOT_IMPLEMENTED`. `mocks/scenarios.ts` controla cenários nomeados, atrasos e falhas de uso único do catálogo e do carrinho (leitura/escrita); o atraso de leitura do carrinho modela latência de resposta (estado lido antes da espera). Nada disso é acessível aos componentes de produto.

## Tempo real

`PublicLayout` é o único dono da conexão: carrega o módulo de tempo real depois do MSW (importar Socket.IO antes capturaria o WebSocket original), conecta explicitamente e descarta ao desmontar, inclusive sob Strict Mode. `realtime/catalog.ts` valida envelopes, deduplica por histórico de eventos, preserva detalhes mais recentes, invalida listas/relacionados e, quando o NFT do evento está no carrinho, busca o carrinho de novo por REST sem recalcular valores. Reconexões reconciliam todas as consultas ativas por REST. `PublicLayout` informa a identidade atual ao cliente de tempo real: ouvintes privados são liberados em cada troca e envelopes de outro usuário ou geração são ignorados (nenhum evento privado é emitido ainda). O mock usa WebSocket, namespace padrão e texto com heartbeat, sem servidor externo.

## Testes e verificação

`testing/harness.ts` só existe no build de integração explícito (`window.__KURIO_TEST__`); `/__protocol` inicializa mocks/ponte sem montar a interface. A suíte de integração cobre aritmética ETH (Node), protocolo, descoberta, carrinho e sessão em desktop/mobile pela interface real, handlers MSW e cliente Socket.IO reais. O E2E roda no build normal, confirma a ausência da ponte e mantém referências visuais de início, detalhe e carrinho, com fontes, imagens e relógio estáveis e inspeção antes de aceitar mudanças. Lighthouse audita início e detalhe, três vezes por perfil. A preparação Vercel é somente configuração; nenhum deploy foi realizado.

## Próximas etapas

Preservar a URL como fonte do estado da descoberta, isolamento de caches/assinaturas por usuário e geração de sessão (já aplicado ao carrinho e ao tempo real; novos dados privados devem seguir o mesmo escopo), aritmética ETH exata, valores determinados pela API, a regra única de versão no cache, criação idempotente de pedidos, recibos imutáveis, eventos privados versionados e reconciliação REST. Rotas privadas devem usar `requireSession`. Os adaptadores de indisponibilidade restantes (finalizar, favoritar, perfil, carteiras, login social, recuperação de senha e ações editoriais) serão substituídos pelos fluxos autorizados, sem falsos sucessos.

## Limitações registradas

- **Rede de pagamento independente da rede do NFT (simplificação deliberada).** O carrinho aceita NFTs de redes diferentes e estima a taxa para Ethereum; no checkout, qualquer carteira cadastrada pagará o pedido inteiro na rede dela. Numa integração real, um NFT só pode ser adquirido na rede em que foi emitido, e um carrinho com redes diferentes exigiria restringi-lo a uma rede ou dividir o pedido por rede. A regra entraria na validação da cotação/pedido (`POST /quotes` e `POST /orders` rejeitando itens incompatíveis com a rede da carteira) e no filtro de carteiras do checkout (exibir só carteiras compatíveis ou separar o pedido).
- **Token de sessão acessível ao JavaScript (simplificação da simulação).** O cliente guarda o token opaco em localStorage e o envia em `Authorization`. Em produção, a sessão seria um cookie `HttpOnly`, `Secure` e `SameSite`, invisível ao JavaScript, o que reduz o impacto de XSS.
- Adicionar ao carrinho não reserva estoque; a cotação deverá revalidar preço e disponibilidade.
- Estado simulado entre abas: adoção do retrato mais recente por contador lógico, sem coordenação completa nem notificação ativa; duas gravações no mesmo `tick` resolvem por última gravação.
- Desempenho mobile abaixo da meta de 90 no Lighthouse; causas em `docs/cart-verification.md`.

Detalhes e decisões: [sessão](docs/session.md), [carrinho](docs/cart.md), [verificação do carrinho](docs/cart-verification.md), [descoberta](docs/discovery.md), [REST](docs/contracts/rest.md), [eventos](docs/contracts/events.md), [cenários](docs/mock-scenarios.md) e [verificação da descoberta](docs/discovery-verification.md).
