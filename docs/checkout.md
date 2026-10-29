# Checkout até a revisão validada

Etapa guiada por `docs/handoffs/coding-agent-checkout-draft-pt-br.md`. Implementa a página de pagamento protegida, dados do colecionador, carteiras cadastradas com conexão simulada, cadastro de carteira no checkout, cotação pela API com revalidação e preservação do rascunho. **Não cria pedidos:** "Confirmar compra" faz a revalidação final e, sem mudanças, mostra que a criação de pedidos chega na próxima etapa.

## Rota, proteção e pré-condições

- `/checkout` usa `requireSession` e `SessionCheckError` (sessão não confirmada por falha transitória mostra nova tentativa). Acesso direto e refresh funcionam.
- No carrinho, "Conectar e finalizar" leva a `/checkout` quando autenticado; deslogado, abre o login sobre o carrinho e segue para `/checkout` (`authLink` com página de fundo diferente do destino). O diálogo de indisponibilidade do carrinho foi removido.
- Carrinho vazio ou com conflitos não abre o checkout: volta ao carrinho com aviso ("Seu carrinho está vazio…" / "Resolva os itens indisponíveis…").
- Expiração durante o checkout usa o fluxo existente: aviso, login sobre a página e retorno a `/checkout`.

## Passos no mobile e composição por largura

Até 700px (o mesmo limite do login), o checkout tem três passos em `?step=dados|carteira|revisao` (`src/lib/checkout-search.ts`), com voltar, avançar e refresh. Não se avança com o passo atual inválido: dados do colecionador inválidos voltam a `dados` (com foco no primeiro erro) e `revisao` exige carteira escolhida; "Continuar" no passo da carteira fica indisponível até a conexão estar ativa. Mudar de passo leva o foco ao título do passo. O botão de ação fica numa barra `position: sticky` no fim do passo, que reserva o próprio espaço e respeita safe area e teclado virtual.

Acima de 700px é a página única do desktop. **Em 768px usa-se a página única**; entre 701 e 1000px as duas colunas são empilhadas para não comprimir os campos em duas colunas. 390, 414, 768 e 1440px foram verificados sem overflow horizontal, inclusive com valores ETH e endereços longos. Redimensionar não perde dados: o estado é o mesmo nas duas composições.

## Rascunho

Os dados digitados e a carteira escolhida ficam em `sessionStorage` (`kurio.checkout.draft.v1:<userId>`, `src/data/checkout/draft.ts`).

- Sobrevivem a refresh e à expiração da sessão: entrando de novo com o mesmo usuário, o checkout volta preenchido.
- São descartados no logout e quando outro usuário entra (inclusive rascunhos deixados por uma sessão expirada de outro usuário).
- Não guardam estado de conexão nem valores de cotação: a conexão é refeita e a cotação é sempre buscada de novo.

## Dados do colecionador

Conforme `CheckoutCollectorData`, com validadores compartilhados em `collectorErrors` (`src/contracts/checkout.ts`):

- obrigatórios: nome de exibição, nome de usuário, e-mail e nome do perfil;
- opcionais: código de indicação (`[A-Z0-9-]`, 4 a 20), nome ENS (escolhido numa lista, ver abaixo), ENS ou carteira secundária (endereço válido para a rede da carteira ou nome `.eth`) e observação (até 500 caracteres, com contador).

As regras de formato não aparecem de antemão (o frame não as mostra): o texto da regra aparece na mensagem de erro, depois de um envio inválido.

**Pré-preenchimento:** primeiro pelos dados descritivos da carteira selecionada, depois pela conta (username, e-mail, nome de exibição). O que o usuário digita fica no rascunho e nunca é sobrescrito; ao trocar de carteira, só os campos não digitados acompanham a nova carteira. Alterar dados no checkout não atualiza conta nem carteira.

## Carteiras

- **Endpoints:** `GET /wallets` e `POST /wallets` (edição fica para a etapa de carteiras).
- **Seed:** `ada_example` tem "Principal" (`primary`, Ethereum, MetaMask, `0xA91F…E82C`) e "Reserva" (`secondary`, Polygon, Coinbase Wallet, `nova.kurio.eth`), com nome de exibição, nome do perfil e e-mail coerentes com a conta. `lin_example` começa sem carteiras.
- **Validação** (`walletErrors` em `src/contracts/wallets.ts`, no cliente e no servidor): endereço por rede (Ethereum e Polygon `^0x[0-9a-fA-F]{40}$`; Solana base58 de 32 a 44), endereço único por usuário (409, sem diferenciar maiúsculas), provedor entre os três suportados e nome da carteira obrigatório.
- **Primária e secundária:** a primeira carteira de um usuário vira `primary`; as seguintes, `secondary`. O papel é decidido pelo servidor (não vem no pedido), então nunca há duas primárias.
- **Isolamento:** a consulta `['wallets', escopo]` usa o mesmo escopo de usuário e geração do carrinho e é limpa no logout, na expiração e na troca de usuário.
- **Cadastro no checkout:** "Trocar carteira" (mobile) e "Usar outra carteira?" (desktop) listam as carteiras cadastradas e oferecem "Cadastrar nova carteira" (nome, rede, provedor e endereço). Cadastrada, a carteira fica selecionada; erros do servidor aparecem nos campos. Para quem não tem carteiras, o formulário já aparece aberto (sem tirar o foco da página).

## Conexão simulada

Sem extensão real. Selecionar uma carteira chama `POST /wallet-connections` com `walletId`; o mock responde após uma latência curta (300ms) com a conexão ativa ou 409 `CONNECTION_REJECTED`, conforme o cenário. A interface mostra "Conectando à MetaMask…", "MetaMask conectada · Rede Ethereum" ou "Conexão recusada na carteira." com "Tentar novamente". Uma conexão ativa por usuário: conectar outra carteira libera a anterior.

A desconexão (controle de cenário) é detectada pela API: `GET /wallet-connections/:id` ao confirmar e ao recuperar o foco da janela, e a cotação responde 409 `WALLET_DISCONNECTED`. A interface informa, desabilita "Confirmar compra" e oferece "Reconectar". Nenhum evento privado de Socket.IO é usado. Nenhuma cotação é pedida sem conexão ativa.

## Cotação e revalidação

`POST /quotes` recebe `{ cartId, cartVersion, walletId }`; a rede vem da carteira no servidor. O servidor confere sessão, titularidade do carrinho e da carteira (403), conexão ativa (409 `WALLET_DISCONNECTED`), versão do carrinho (409 `CART_CHANGED`), disponibilidade atual (409 `UNAVAILABLE_ITEMS`, com uma mensagem por linha afetada em `fields`, sem reduzir quantidades) e **revalida o cupom, inclusive a expiração**: cupom expirado sai da cotação com `couponRemoved` e o motivo. A taxa é a da rede da carteira (`src/contracts/eth.ts`). A cotação retorna `id`, `version`, `expiresAt` (**2 minutos pelo relógio real**), itens, cupom, valores e `requiresConfirmation`.

Regra de nova confirmação (`useCheckoutQuote`):

- Mudanças feitas pelo usuário (carteira, cupom, conteúdo do carrinho) geram nova cotação diretamente.
- Atualizações que o usuário não causou — `nft.updated` de um item (que busca o carrinho de novo), a renovação automática da cotação expirada e a revalidação de "Confirmar compra" — são comparadas com a cotação exibida. Se preço, quantidade, cupom, taxa ou total mudaram, **nada prossegue**: um aviso lista o que mudou (valor anterior e atual, cupom removido) e exige "Revisei, confirmar com os novos valores". Os valores exibidos não são trocados em silêncio.
- Itens indisponíveis mostram as linhas afetadas e levam ao carrinho para ajuste.
- Sem mudanças e com conexão ativa, "Confirmar compra" abre o diálogo "Revisão concluída", informando que nenhum pedido foi criado e que carrinho e rascunho continuam salvos.

## Decisões e desvios do Figma

- **Rótulos (orientação do usuário):** obrigatório tem asterisco; opcional não tem asterisco nem "(opcional)" no rótulo. "Código de indicação" e "Nome ENS" perdem o asterisco do frame (são opcionais, conforme `docs/contracts/rest.md`); "Rede", "Endereço da carteira" e "Tipo de carteira" mantêm o asterisco, porque sempre vêm da carteira selecionada. "Observação do colecionador" também perde o "(opcional)" do frame.
- **"ENS ou carteira secundária":** sem rótulo visível, como no frame (rótulo só para leitores de tela), alinhado ao endereço; o "(opcional)" fica só no placeholder, que cabe inteiro em 390px e no desktop.
- **"Nome ENS" como lista (orientação do usuário):** é o seletor ".eth" do frame. A opção ".eth" significa nenhum nome; as demais são os nomes ENS das carteiras do usuário (por exemplo `nova.kurio.eth`, da "Reserva"). Por ser uma lista, não há regra de formato.
- **Regras de formato só no erro:** as ajudas de "Código de indicação" (e do antigo campo de texto do ENS), ausentes no frame, não aparecem de antemão; a regra vem na mensagem de erro após envio inválido. O contador da observação permanece.
- **Rede, tipo e endereço vêm da carteira:** os selects "Rede" e "Tipo de carteira" e o campo "Endereço da carteira" mostram a carteira selecionada, somente leitura; trocar de carteira os atualiza.
- **Lista de provedores segue a carteira cadastrada:** o provedor da carteira selecionada vem marcado; escolher outro seleciona a carteira do usuário com esse provedor ou oferece cadastrar uma já com o provedor escolhido. No desktop, a primeira opção é o selo "METAMASK • WALLETCONNECT • COINBASE", tratado como WalletConnect (nome acessível "WalletConnect").
- **Taxa:** com a carteira escolhida, a legenda é a rede efetiva ("Taxa de rede (Polygon)"), não "Taxa estimada".
- **Resumo no mobile:** o frame mostra só o Total no passo da carteira; o passo de revisão traz itens, subtotal, desconto, taxa e total da cotação.
- **Menu "⋮":** usa o diálogo de indisponibilidade (edição na etapa de carteiras).
- **Valores desenhados** são exemplos; todos os valores vêm da cotação da API.
- **Cabeçalho:** usa o cabeçalho autenticado, não o "Entrar" do frame.
- **Ícones dos provedores:** o arquivo do Figma não exportou ícones de carteira; os três provedores usam o selo com a inicial (W, M, C) do frame.
- **Avisos no mobile:** no checkout mobile os avisos aparecem no topo, para não cobrir a barra de ação; o estado da conexão é anunciado pela própria região de status, sem repetir no aviso.
- **Passos no mobile:** o frame cobre só o passo da carteira; os passos de dados e revisão seguem o mesmo cabeçalho com "Voltar".

## Indisponibilidades que permanecem

Criação de pedido (diálogo "Revisão concluída"), edição de carteira e menu "⋮", página de carteiras, perfil, favoritos e login social.
