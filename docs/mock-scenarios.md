# Estado dos mocks, cenários e controles de integração

A interface de descoberta consulta NFTs via Axios/Query e mantém uma conexão pública de Socket.IO por layout. A inicialização dos mocks carrega o retrato do catálogo antes de registrar handlers e renderizar. Nenhuma página ou painel de depuração de produto é adicionado.

## Estado persistido de referência

`src/mocks/store` usa um único retrato em memória, persistido de forma síncrona no localStorage sob **`kurio.mock.catalog.v1`**. Os retratos incluem `schemaVersion: 4`, `seedVersion: 2`, um contador lógico `tick`, os 24 NFTs, os visitantes (token → carrinho), os carrinhos, as contas, as sessões e o contador global de geração de sessão. Não é necessário outro pacote para esse pequeno conjunto de dados. Leituras do carrinho, atualizações e restaurações passam pela mesma fila serializada de promessas, de modo que uma leitura nunca observa um estado anterior a uma escrita já enfileirada. Uma gravação só é confirmada em memória depois de o armazenamento ter sucesso; falhas são propagadas em vez de simular persistência. Retratos ausentes, malformados, estruturalmente inválidos ou incompatíveis restauram e salvam a massa inicial determinística. Indisponibilidade ou falta de espaço no armazenamento causam falhas visíveis pelo tratamento de inicialização ou pela chamada aguardada ao controle.

O armazenamento é limitado a essa chave; a restauração não limpa dados de outras partes da origem. Recarregamentos normais e reconexões de socket preservam o retrato. **Múltiplas abas:** antes de cada operação, o store adota o retrato persistido se o `tick` dele for maior que o da memória; não há eventos de armazenamento, bloqueios ou transmissões entre abas, e duas gravações no mesmo `tick` resolvem por última gravação. Uma aba vê a mudança da outra na próxima leitura (inclusive ao recuperar o foco). Contextos novos do Playwright isolam os testes.

A restauração aborta requisições de cenário pendentes, limpa falhas de uso único, atrasos, diagnósticos e histórico de reenvio de eventos; fecha sockets ativos; restaura todo o catálogo, versões de esquema/massa inicial e contador lógico zero; depois permite novas conexões. Não restaura dados não relacionados da aplicação/origem. A estrutura de testes também descarta observadores/tempo real e limpa o QueryClient de teste. Não existem eventos de domínio agendados: os controles de atualização emitem imediatamente após uma transação persistida bem-sucedida. Atrasos pendentes de resposta não podem posteriormente alterar o estado ou emitir eventos. Os temporizadores de manutenção da conexão são liberados no fechamento.

IDs da massa de dados: `nft-001`..`nft-024`; cada NFT possui `edition-N-limited` (limite de emissão 20 / disponibilidade 10) e `edition-N-unique` (1 / 1). São nove categorias públicas, duas redes (ethereum/polygon), vários preços e três páginas padrão de oito itens. Os nomes alternam entre Emerald Ape, Sage Nomad, Noon Verbal, Cosmic Bloom, Violet Nomad e Ivory Baron. Os dois primeiros preços limitados padrão são 1.19 e 1.69 ETH. O teste de precisão injeta `1.000000000000000001` e `1.000000000000000002` nos mesmos IDs, mantendo a comparação de valores indistinguíveis como números de ponto flutuante em JS. Os demais preços limitados alternam de 1 a 7 ETH; edições únicas custam 12 ETH. Valores de arte são apenas identificadores. Datas/horários derivam de `2026-01-01T00:00:00.000Z`; atualizações avançam um segundo por incremento lógico persistido, e versões aumentam por NFT. IDs de eventos usam esse contador global. A restauração reinicia intencionalmente o histórico de identidade/versão e exige consumidores novos, como os fornecidos pela estrutura de testes.

`fixtureUsers` contém `user-ada` / `ada@example.test` e `user-lin` / `lin@example.test`, com usernames `ada_example` e `lin_example` e nomes de exibição fictícios; `fixturePasswords` guarda apenas sal e hash PBKDF2-SHA256 das senhas de demonstração do README. Não existe estado de perfil, carteira ou pedido; carrinho e sessão estão descritos nas seções de extensões abaixo.

## Cenários nomeados e controles

`startMocks(baseURL)` retorna controles dentro do código exclusivo de mocks; componentes normais nunca os recebem. O estado dos cenários é transitório, não persistido; o recarregamento restaura o catálogo persistido e o comportamento padrão das requisições.

| Controle                                              | Efeito                                                                                                          |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `reset()`                                             | Restauração integral do estado implementado, descrita acima                                                     |
| `scenarios.select('default')`                         | Respostas reais da massa determinística, sem atraso injetado                                                    |
| `scenarios.select('empty')`                           | Lista vazia, detalhe com comportamento normal                                                                   |
| `scenarios.select('http-error')`                      | Requisições de NFT retornam 503 `TRANSIENT`                                                                     |
| `scenarios.select('network-error')`                   | Requisições de NFT recebem falha de rede do MSW, sem resposta HTTP                                              |
| `scenarios.select('out-of-order')`                    | A busca `emerald` leva 300ms; as demais, 0ms                                                                    |
| `scenarios.setDelay(search, ms)`                      | Sobrescreve o atraso da busca normalizada exata; de 0 a 10.000ms; string vazia afeta listagem sem busca/detalhe |
| `scenarios.failNext('http' or 'network')`             | Falha uma vez na próxima requisição válida de NFT, capturada no início da requisição                            |
| `update(nftId, editionId, { priceEth?, available? })` | Valida, persiste, avança relógio/versão e transmite `nft.updated`                                               |
| `duplicate()` / `older()`                             | Reenvia o último evento / uma versão sintética anterior via Socket.IO; sem alterar o estado                     |
| `interrupt()` / `restore()`                           | Fecha/bloqueia sockets simulados / permite reconexão; nunca restaura o catálogo                                 |

Cenários nomeados e atrasos por busca são capturados no início de uma requisição válida, permitindo conclusão controlada fora de ordem. Parâmetros desconhecidos/inválidos são rejeitados imediatamente sem consumir falhas de uso único. Selecionar um cenário não restaura a persistência; use `reset()` explicitamente para isolamento. A latência é determinística; não há aleatoriedade ou dependência de rede. Chamadores HTTP usam o mesmo caminho Axios em todos os modos.

Endpoints de API não suportados retornam erros JSON 501 visíveis. Tráfego desconhecido e não tratado sob o prefixo de API configurado é reportado como erro do MSW; requisições fora dessa origem/prefixo não são interceptadas, preservando o Vite e os recursos estáticos. A interceptação WebSocket trata o endpoint dedicado `/api/socket.io/`. Polling não é um transporte suportado pelos mocks.

## Comportamento das consultas

`src/data/nfts` fornece funções de API Axios tipadas, validadores de resposta e fábricas de opções Query. Chaves de lista são `['nfts', 'list', normalizedQuery]`; chaves de detalhe são `['nfts', 'detail', id]`. Todo parâmetro de lista é normalizado e incluído, inclusive filtros vazios e paginação. Preços decimais equivalentes geram chaves equivalentes. Os dados públicos de catálogo não possuem escopo fictício de usuário/sessão. Consultas são consideradas desatualizadas imediatamente (`staleTime: 0`) e desabilitam novas tentativas automáticas para manter falhas injetadas observáveis; os chamadores podem tentar novamente explicitamente após remover a falha. Nenhuma política global de Query é alterada para funcionalidades privadas futuras.

O `AbortSignal` do Query é repassado ao Axios. Remover o último observador de uma requisição em andamento a cancela; chaves separadas isolam respostas fora de ordem. A camada de tempo real cancela trabalho antigo de detalhe, grava conteúdos mais recentes e invalida/busca novamente listas ativas. Conexão/reconexão invalida detalhes e listas ativos via REST; entradas inativas permanecem desatualizadas. Consulte os [contratos de eventos](contracts/events.md) para proteção de versões e descarte.

## Estrutura exclusiva de testes e verificações reproduzíveis

```sh
npm run build:integration
npm run test:integration
```

`build:integration` gera um build otimizado do Vite no modo `integration` em `dist-integration/`, ignorado pelo Git. `.env.integration` habilita explicitamente os mocks e `VITE_ENABLE_TEST_HARNESS=true`. Não use esse build em demonstração pública. O Playwright gerencia um servidor de pré-visualização na porta 4178 e usa contextos Chromium isolados. Os testes aguardam a ponte de integração e restauram o estado antes de cada caso. Usam condições observadas de estado/rede com verificações de tempo limitado, não coordenação por esperas fixas em tempo real. O teste de manutenção da conexão usa relógio virtual do navegador.

Somente esse build habilitado explicitamente importa dinamicamente `src/testing/harness.ts` e expõe **`window.__KURIO_TEST__`** após a inicialização. Builds normais removem essa importação e seu arquivo; os testes do build normal verificam que a ponte está ausente. O ambiente do processo ou `.env.local` podem sobrescrever valores do modo, então evite configurações conflitantes ao reproduzir as verificações.

Métodos da ponte: `reset`, `list(query)`, `detail(id)`, `rawDetail(id)`, `request(relativeApiPath)`, `select(query)` (um QueryObserver ativo), `watchDetail(id)`, `state(id?)`, `connect`, `disconnect`, `dispose`, `recreate`, `update`, `persistUpdate`, `replay`, `duplicate`, `older`, `interrupt`, `restore`, `scenario(name)`, `delay(search, ms)`, `failNext(kind)`, `snapshot`, `compareEth`. `state()` expõe o estado da consulta selecionada, detalhe em cache, contagens reais de conexões/listeners do socket, requisições/cancelamentos e diagnósticos do consumidor. `reset()` limpa o estado Query e o dos mocks. Os controles de cenário emitem pela conexão interceptada; nunca atualizam Query diretamente. `request` captura falhas HTTP/de rede esperadas para as verificações. Não existe endpoint de API de produção para controles de teste.

A suíte de integração cobre filtros/ordenação/paginação, erros de consulta/404/endpoints não suportados, precisão de ETH, recarregamento persistido/restauração/esquema corrompido, seleção fora de ordem/cancelamento, recuperação de falhas, atualização real Socket.IO consistente com REST/persistência, eventos duplicados/antigos, reconciliação após reconexão, limpeza de listeners e manutenção de conexões ociosas.

A verificação do build normal com mocks é:

```sh
npm run build
npm run test:e2e
```

A interface inclui início/catálogo, detalhe e carrinho do visitante. O build normal deve usar mocks habilitados para demonstração, pois não há backend real; desabilitá-los não fabrica respostas alternativas. A auditoria cobre início e detalhe. Checkout, pedidos e assinaturas privadas continuam adiados. Consulte `docs/discovery.md` e `docs/cart.md`.

Para testar versões diferentes entre caches, `persistUpdate` persiste uma atualização sem emitir evento; `replay(envelope)` envia o envelope pela conexão Socket.IO interceptada. Assim, o teste pode atualizar o detalhe via REST enquanto a lista permanece antiga e só então entregar o evento real. Esses controles não alteram o cache Query diretamente.

## Extensões da etapa de descoberta

A seed 2 amplia NFTs/edições, categorias, redes, arte local, metadados, classificação e avaliações, mantendo IDs anteriores. A chave localStorage histórica continua a mesma; esquema/seed anteriores restauram somente essa chave. Edição aberta usa oferta simulada finita 100, disponibilidade inicial 30 e limite 3; no NFT inicial está esgotada. Os demais limites de seleção estão em `docs/discovery.md`.

No build de integração, a suíte de protocolo acessa `/__protocol`, que inicializa a ponte sem montar o produto. Os testes públicos acessam `/` e `/nfts/...`, montando a interface, seus observadores e a conexão reais. Isso impede que o tráfego da aplicação altere diagnósticos/contagens da suíte isolada. A prontidão continua condicionada à inicialização do estado e do MSW. O modo padrão de desenvolvimento/build agora habilita mocks; a ponte continua somente na configuração explícita integration.

A camada de tempo real invalida também relacionados após eventos e reconexões. Os 14 testes de protocolo foram preservados; novas suítes observam a interface em desktop/mobile. Saídas de execução usam `test-results/e2e` e `test-results/integration`, evitando que uma suíte remova traces da outra.

## Extensões da etapa do carrinho

O retrato passa a `schemaVersion: 3` (seed 2 mantida), na mesma chave `kurio.mock.catalog.v1`, com `visitors` (token → carrinho) e `carts` (linhas com quantidade e último preço reconhecido, cupom, versão e `updatedAt`). Retratos da versão 2 são incompatíveis e restauram somente essa chave; o token do visitante (`kurio.visitor.v1`) é do cliente e um token desconhecido recebe 401, sendo substituído. `reset()` restaura carrinhos e visitantes vazios. Toda gravação, inclusive do carrinho, avança o mesmo relógio lógico `tick`. Cupons e taxas por rede são fixtures em `src/mocks/store/seed.ts`; regras do carrinho em `src/mocks/store/cart.ts`.

**Múltiplas abas (atualiza a regra de "somente uma aba"):** antes de cada leitura e de cada transação de escrita, o store adota o retrato persistido se seu `tick` for maior que o da memória. Não há notificação entre abas e gravações simultâneas no mesmo `tick` resolvem por última gravação. Ver [carrinho](cart.md).

| Controle (mocks / ponte)                                           | Efeito                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scenarios.failNextCart(kind, 'read' \| 'write')` / `failNextCart` | Falha uma vez a próxima leitura ou mutation do carrinho (`http` = 503, `network` = falha de rede)                                                                                                                                              |
| `scenarios.setCartDelay('read' \| 'write', ms)` / `cartDelay`      | Atraso de 0 a 10.000ms do carrinho, separado do catálogo. Escrita: espera antes de gravar. Leitura: latência de resposta (o estado é lido antes da espera, então uma leitura lenta pode trazer estado anterior a uma escrita concluída depois) |
| `forgetCart()` (somente ponte)                                     | Remove o carrinho do cache Query para que o próximo observador comece pendente (skeleton)                                                                                                                                                      |
| `update(...)` existente                                            | Altera preço/disponibilidade de um item do carrinho e emite `nft.updated`                                                                                                                                                                      |

Cupons inválido/expirado não precisam de controle: `KURIO15` é sempre expirado e qualquer código fora das fixtures é inexistente. A resposta 503 transitória passou a ter mensagem genérica em pt-BR ("Serviço temporariamente indisponível. Tente novamente."), pois também atende o carrinho. O projeto `eth-unit` do Playwright roda a aritmética de ETH em Node, sem navegador; `cart-desktop`/`cart-mobile` rodam os fluxos do carrinho na interface real.

## Extensões da etapa de sessão

Contas (`accounts`), sessões (token opaco → usuário, geração, `expiresAt`, `revokedAt`) e o contador `generation` fazem parte do retrato (`schemaVersion` 4); retratos anteriores restauram a seed. Cadastro cria a conta com carrinho próprio e já autentica; login e cadastro consomem o carrinho de visitante indicado em `X-Visitor-Token`. A validade da sessão usa o relógio real (7 dias). Regras em [sessão](session.md).

| Controle da ponte (`window.__KURIO_TEST__`) | Efeito                                                                                       |
| ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `identity()`                                | Retrato da identidade do cliente (tokens, sessão verificada, estado)                         |
| `signOut()`                                 | Mesmo logout da interface: limpa a identidade local e revoga o token                         |
| `expireSession()` / `revokeSession()`       | Expira / revoga no servidor simulado a sessão atual; a próxima requisição privada recebe 401 |
| `cartDelay('read' or 'write', ms)`          | Atraso de resposta do carrinho, usado para respostas tardias da sessão anterior              |
| `state().transport`                         | Contadores de requisições e de requisições canceladas pelo cliente                           |

Gravações do retrato podem disparar uma nova leitura do carrinho (adoção do retrato mais recente). Por isso, depois de `expireSession()`, o aviso de expiração pode surgir sem nenhuma ação na interface; os testes aceitam qualquer uma das duas origens da requisição privada.

## Extensões da etapa do checkout

O retrato passa a `schemaVersion` 5: carteiras (seed de `ada_example` com "Principal" e "Reserva"; `lin_example` sem carteiras), conexões simuladas e cupons expirados por cenário. Retratos anteriores restauram a seed. As cotações não são persistidas: cada `POST /quotes` recalcula a partir do estado atual. Regras em [checkout](checkout.md).

| Controle da ponte (`window.__KURIO_TEST__`)                      | Efeito                                                                                                           |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `rejectNextConnection()`                                         | A próxima conexão de carteira responde 409 `CONNECTION_REJECTED`                                                 |
| `disconnectWallets()`                                            | Desconecta no servidor todas as conexões ativas (detectado ao confirmar, no foco e pela cotação)                 |
| `checkoutDelay('quote' or 'connection', ms)`                     | Latência da cotação ou da conexão (a conexão tem 300ms por padrão)                                               |
| `failNextCheckout('http' or 'network', 'quote' or 'connection')` | Falha transitória de uso único na próxima cotação ou conexão                                                     |
| `quoteTtl(ms)`                                                   | Validade das próximas cotações (padrão 2 minutos); fica em `sessionStorage` para sobreviver às recargas do teste |
| `expireCoupon(code)`                                             | Expira o cupom; a próxima cotação o remove com o motivo                                                          |

Mudanças de preço e disponibilidade usam os controles existentes: `update` (persiste e emite `nft.updated`; aceita também `name`) e `persistUpdate` (persiste sem evento, para testar a revalidação ao confirmar).

## Extensões da etapa de pedidos

O retrato passa a `schemaVersion` 6: cotações persistidas (`quotes`, as 50 mais recentes, e `quoteSequence`), pedidos (`orders`, com `resolveAt` e resultado simulado), chaves de idempotência (`idempotency`, `userId:chave` → pedido e corpo canônico) e `orderSequence`. Retratos anteriores restauram a seed. O pagamento simulado é aprovado após 1,5s por padrão; a resolução roda ao ler o pedido e a cada 250ms. Regras em [pedidos](orders.md).

| Controle da ponte (`window.__KURIO_TEST__`)      | Efeito                                                                                                                            |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `setPayment(outcome, delayMs?)`                  | Resultado (`confirmed` ou `declined`) e atraso dos próximos pagamentos; fica em `sessionStorage` (`kurio.mock.payment`)           |
| `resolvePayments()`                              | Resolve agora todos os pedidos pendentes, ignorando o atraso                                                                      |
| `loseNextOrderResponse()`                        | O próximo `POST /orders` cria o pedido, mas a resposta se perde (erro de rede): demonstra o timeout depois da criação             |
| `changeBeforeNextOrder(nftId, editionId, patch)` | Altera o NFT logo antes do próximo `POST /orders` (cotação muda entre a revisão e o envio → 409 `QUOTE_CHANGED`)                  |
| `duplicateOrder()` / `staleOrder(patch)`         | Reenvia o último `order.updated` / envia um envelope sintético com versão anterior                                                |
| `authenticatedSockets()`                         | Conexões de socket associadas a uma sessão                                                                                        |
| `probeSocket(token)`                             | Abre um segundo cliente `socket.io-client` autenticado com `token` e registra os nomes dos eventos recebidos (teste de vazamento) |

Para reproduzir manualmente uma recusa ou um timeout depois da criação, use a ponte do build de integração (`npm run build:integration` e `npm run preview -- --outDir dist-integration`) e chame `__KURIO_TEST__.setPayment("declined")` ou `__KURIO_TEST__.loseNextOrderResponse()` no console antes de confirmar a compra.
