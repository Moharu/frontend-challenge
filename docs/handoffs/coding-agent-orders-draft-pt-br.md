# Próxima etapa: pedidos, pagamento simulado e recibo

## Objetivo

Última etapa do fluxo principal: catálogo → NFT → carrinho → login → checkout → **recibo confirmado**. Implementar, com a infraestrutura REST, Query, MSW e Socket.IO existente:

- cotações persistidas e versionadas, comparadas no servidor na criação do pedido;
- criação idempotente de pedidos, sem duplicidade em cliques repetidos, timeout e refresh;
- estados `pending → confirmed | declined`, com estados terminais que não regridem;
- evento privado `order.updated` entregue apenas à sessão dona do pedido;
- recuperação de pedido pendente após refresh e reconexão;
- tela de confirmação com recibo imutável, exibida somente após a confirmação simulada;
- carrinho preservado na recusa e reduzido apenas das quantidades compradas na confirmação.

Fora desta etapa: histórico ou listagem de pedidos, perfil, edição de carteiras, favoritos, login social e a etapa final de desempenho.

## Ponto de partida e referências

- Repositório: https://github.com/Moharu/frontend-challenge
- Último commit revisado: `83f4a2b` (checkout e correções).
- Requisitos: `docs/challenge-requirements.md`, em especial "Confirmação de pedido", duplicidade, estados do pedido, recuperação, recibo imutável, eventos e as falhas de pagamento e timeout.
- Contratos e decisões existentes: `ARCHITECTURE.md`, `docs/contracts/rest.md` (pedidos, idempotência e snapshots), `docs/contracts/events.md` (`order.updated`), `docs/mock-scenarios.md`, `docs/checkout.md`, `docs/session.md` e `src/contracts/{orders,checkout,quotes,events}.ts`.
- Figma: https://www.figma.com/design/Zbw0vAAPU80HoDwKVfAcCR/Frontend-Challenge--Copy-?node-id=0-1
- Implantação: Vercel. Não implantar nesta tarefa.

Inspecione o checkout atual e as instruções aplicáveis antes de editar. Preserve trabalho mais recente; não resete para o commit citado. Reutilize a stack e o lockfile existentes. Não crie repositório remoto, commit, push ou deploy sem autorização separada.

## Consulta ao design

Consulte o Figma em modo somente leitura ou as capturas fornecidas pelo usuário. Não altere o arquivo.

Frame desta etapa: Desktop / Confirmação de Pedido (`11:4385`). **Não há frame mobile**; adapte a partir do desktop.

Observações verificadas na captura, a confirmar no arquivo:

- Cartão centralizado sobre fundo escuro, com botão de fechar (×) e borda inferior cobre.
- Ilustração "THANK YOU" e o título "Seus NFTs agora estão na sua carteira".
- Faixa com quatro dados separados por divisores: "ID da transação" (`0xA91F…E82C`), "Data" (`29 Jul, 2026`), "Total" e "Carteira".
- "Detalhes da transação": tabela com NFTs (arte, nome, ID do token), "Edições" (`x 2`) e "Subtotal", seguida de "Taxa de rede" e "Total".
- Texto final: "Transação confirmada na Ethereum. A propriedade foi transferida para sua carteira conectada e registrada na rede."
- Botão "Ver no Etherscan".

### Inconsistências e decisões de design

- **Página, não modal.** A confirmação é uma rota real (por exemplo `/orders/$orderId`), com acesso direto e refresh, porque o requisito pede recuperar pedidos pendentes após refresh. No desktop, reproduza a composição do Figma: cartão centralizado sobre fundo escuro. No mobile, o cartão ocupa a largura da tela, em coluna única, com a faixa de dados empilhada. O × leva ao catálogo. Documente.
- **Estados não desenhados.** O Figma só mostra o estado confirmado. Crie, com a mesma linguagem visual:
  - **pendente:** "Aguardando confirmação da rede", com indicador de progresso que respeita `prefers-reduced-motion`, o resumo do pedido e a garantia de que o usuário pode sair e voltar a esta URL;
  - **recusado:** motivo legível e ação "Voltar ao checkout", informando que o carrinho foi preservado.

  O título "Seus NFTs agora estão na sua carteira" e a ilustração aparecem **somente** no estado confirmado.
- **Discriminação do recibo.** O recibo mostra subtotal, taxa de rede e total, como pede o requisito ("itens, taxas e total"), mesmo que o frame só mostre taxa e total. A linha de desconto (com o código do cupom) aparece **somente quando houve desconto** (valor maior que zero); sem desconto, ela não é exibida, nem como "0 ETH".
- **Rede no texto.** "Transação confirmada na Ethereum" usa a rede efetiva do pedido (Polygon, quando for o caso).
- **"Ver no Etherscan".** Usa o diálogo de indisponibilidade: não há blockchain real nem link externo. Decisão do usuário; documente.
- **Data e valores.** A data vem de `confirmedAt` do recibo, formatada em pt-BR. O ID da transação é a referência simulada (`transactionReference`), abreviada na faixa e completa com nome acessível. Os valores vêm do recibo, nunca do catálogo ou do carrinho.

## 1. Cotações persistidas e versionadas

Hoje as cotações não são persistidas: a sequência fica em memória e reinicia no reload, e `version` é sempre 1. O cliente compara cotações por conta própria e ignora `requiresConfirmation`. A proteção real precisa estar no servidor.

- Persista as cotações emitidas no estado simulado, com nova versão de esquema e `reset()` restaurando um estado conhecido, com id estável e único entre reloads.
- A cotação guarda o que é necessário para comparação: usuário, carrinho e versão, carteira e rede, itens com preço unitário e quantidade, cupom e valores.
- Defina a regra de versão e documente-a. Exemplo: uma nova cotação para o mesmo carrinho e carteira com valores diferentes recebe nova `version`, e o id muda a cada emissão.
- Na criação do pedido (seção 2), o servidor recalcula a cotação atual e a compara com a referenciada por `quoteId` e `quoteVersion`. Responda 409 com código próprio (por exemplo `QUOTE_CHANGED`) se:
  - a cotação expirou, não pertence ao usuário ou não existe;
  - preço, disponibilidade, cupom (inclusive expiração), taxa ou total mudaram;
  - a versão do carrinho ou a carteira não conferem.

  A resposta inclui a nova cotação, para o cliente mostrar o que mudou e pedir nova confirmação com o fluxo já existente.
- Decida se `requiresConfirmation` continua no contrato com significado claro, usado pelo cliente, ou se sai. Não deixe um campo que o cliente ignora.

## 2. Criação idempotente do pedido

Endpoints previstos: `POST /orders` (cabeçalho `Idempotency-Key`), `GET /orders/:id` e `GET /orders/:id/receipt`.

- **Corpo:** revise `CreateOrderBody`. A rede vem da carteira, como já decidido para a cotação. Remova `network` do corpo ou exija que coincida com a da carteira, com 409 se divergir, e documente.
- **Chave de idempotência gerada pelo cliente** quando o usuário confirma.
  - Fica persistida em `sessionStorage` com o corpo canônico do pedido e a chave do usuário, antes de a requisição sair.
  - Refresh, timeout ou nova tentativa reutilizam a mesma chave.
  - A chave é descartada quando o pedido chega a um estado terminal visto pelo usuário, no logout e na troca de usuário.
- **No servidor, como já documentado em `docs/contracts/rest.md`:**
  - a chave tem escopo por usuário e o corpo é comparado em forma canônica, independente da ordem das propriedades;
  - mesma chave e mesmo corpo devolvem o **mesmo pedido** (200, sem criar outro), inclusive depois de timeout;
  - mesma chave com corpo diferente responde 409 `CONFLICT`;
  - a validação dos dados do colecionador acontece aqui, no servidor, com os mesmos validadores compartilhados do formulário (400 com `fields`).
- **Snapshots imutáveis na criação:** itens comprados (nome, NFT, edição, quantidade, preço unitário, total da linha), valores, collector (opcionais ausentes como `null`), carteira resolvida no servidor (`walletId`, versão, endereço, rede, provedor) e `collectorNote`. Mudanças posteriores em catálogo, perfil ou carteira nunca alteram um pedido existente.
- **Estoque:** reserve as quantidades na criação do pedido pendente (reduzindo `available`) e libere-as na recusa. Isso evita vender a mesma edição duas vezes enquanto o pedido está pendente. Cada mudança emite o `nft.updated` existente. Documente a regra.
- **Cliques repetidos:** o botão "Confirmar compra" fica desabilitado durante o envio, mas a garantia é a idempotência. Teste com cliques repetidos rápidos e com duas abas.

## 3. Pagamento simulado e estados do pedido

- O pedido nasce `pending`. A resolução para `confirmed` ou `declined` é decidida pelo cenário do mock: aprovação por padrão, com recusa configurável e motivo (por exemplo "Saldo insuficiente na carteira" ou "Transação rejeitada na carteira").
- **A resolução sobrevive ao reload:** guarde no estado persistido o momento previsto de resolução (`resolveAt`, com latência curta documentada) e resolva os pedidos vencidos ao inicializar o mock e em cada acesso, além do temporizador da página. Não dependa só de um temporizador em memória. Em testes, controle o tempo com o relógio do Playwright ou com controles de cenário, sem esperas fixas.
- **Transições:** `pending → confirmed` ou `pending → declined`. Estados terminais nunca regridem nem mudam entre si. Cada transição incrementa `version` e `updatedAt`.
- **Na confirmação, executado exatamente uma vez,** mesmo que a resolução seja disparada de novo ou o evento chegue repetido:
  - o recibo é gerado (`confirmedAt`, `transactionReference` simulada no formato `0x` + 64 hexadecimais, itens, valores e snapshots) e fica imutável;
  - o carrinho do usuário é reduzido **apenas** das quantidades compradas, por edição. Linhas acrescentadas ou aumentadas depois da criação do pedido permanecem; linhas zeradas saem;
  - a reserva de estoque vira venda definitiva.
- **Na recusa:** o carrinho fica intacto, a reserva é liberada e `declineCode` recebe o motivo.
- `GET /orders/:id/receipt` responde somente para pedido confirmado (409 nos demais), e `GET /orders/:id` responde 403 para pedido de outro usuário.

## 4. Evento privado `order.updated` com entrega por sessão

Hoje o socket é público, e um evento privado chegaria a todos os clientes conectados, sendo filtrado só no navegador. Isso equivale a expor pedidos de um usuário a outro, um dos critérios de desclassificação do desafio. Corrija na origem:

- **Autenticação da conexão:** o cliente envia o token de sessão ao conectar. Prefira o `auth` do handshake do Socket.IO, se a integração `@mswjs/socket.io-binding` o expuser. Verifique na versão instalada e documente. Se não expuser, use um evento de texto de autenticação logo após conectar, sem confirmação de recebimento (a integração não suporta acks).
- **No servidor simulado:** associe cada conexão à sessão (usuário e geração) e emita `order.updated` **somente** às conexões autenticadas como o dono do pedido. Conexões anônimas e de outros usuários nunca recebem o evento.
- Login, logout, expiração e troca de usuário reautenticam ou recriam a conexão. O consumidor continua descartando envelopes de outro usuário ou geração (defesa em profundidade) e liberando os listeners privados.
- **Envelope:** `eventId` estável, `resourceId` igual ao id do pedido, `version` igual à do pedido e `audience` conforme `src/contracts/events.ts`. O cliente ignora eventos duplicados e versões antigas e nunca regride um estado terminal.
- **Reconexão:** ao reconectar, o pedido ativo é reconciliado por `GET /orders/:id`, sem depender de reenvio de eventos perdidos.

## 5. Fluxo no cliente

- "Confirmar compra", depois da revalidação sem mudanças que já existe:
  1. gera ou reutiliza a chave de idempotência e envia `POST /orders`;
  2. no sucesso, navega para a página do pedido (substituindo a entrada do checkout no histórico, para que voltar não reenvie a compra).
- Remova o diálogo de indisponibilidade da criação de pedidos.
- **Timeout ou falha de rede no envio:** mostre "Não foi possível confirmar o envio do pedido" com "Tentar novamente", reutilizando a mesma chave. A nova tentativa recupera o pedido já criado, se existir.
- **409 de cotação:** mostre o que mudou e peça nova confirmação; a nova confirmação usa uma **nova** chave, porque o corpo mudou. 409 de chave com corpo diferente nunca deve ocorrer no fluxo normal. Se ocorrer, mostre erro claro e gere nova chave.
- **Refresh no checkout com envio em andamento:** com uma chave pendente em `sessionStorage`, o checkout retoma automaticamente com a mesma chave ("Retomando seu pedido…") e leva à página do pedido.
- **Página do pedido:**
  - busca `GET /orders/:id`;
  - mostra pendente, confirmado (com o recibo de `GET /orders/:id/receipt`) ou recusado;
  - atualiza por `order.updated` e reconcilia por REST na reconexão e ao recuperar o foco;
  - acessível por URL depois de refresh e de um novo login.
- **Expiração da sessão com pedido pendente:** o pedido continua no servidor. Depois de entrar de novo, o retorno leva à mesma página do pedido.
- O carrinho e o badge refletem a redução após a confirmação, pela resposta da API, sem cálculo no cliente.

## 6. Pendências das revisões anteriores

- **Lista de definição inválida:** no checkout, o componente de valores coloca elementos `<p>` diretamente dentro de `<dl>` (dica e motivo do cupom, por volta das linhas 1262–1268 de `src/routes/checkout.tsx`). Mova-os para fora do `<dl>` ou envolva-os corretamente; o axe aponta isso. Confira se o recibo e o carrinho não repetem o padrão.
- **Mensagem de cupom expirado sem saída:** o motivo fica visível até aplicar outro cupom, e o botão "Remover cupom" some porque o cupom vigente é `null`. Permita remover o cupom expirado (o que limpa o código guardado e a mensagem) e ajuste a documentação da decisão em `docs/cart.md`.

## 7. Acessibilidade e responsividade

- Verifique 390, 414, 768 e 1440px.
- A mudança de pendente para confirmado ou recusado é anunciada uma vez em região de status. Foco no título do novo estado.
- A tabela do recibo tem semântica de tabela, cabeçalhos associados e textos alternativos coerentes para as artes.
- O × e "Ver no Etherscan" têm nomes acessíveis. O diálogo de indisponibilidade segue o padrão existente.
- Sem overflow horizontal com IDs de transação e valores longos.

## 8. Testes e verificação

Preserve as suítes existentes. Adicione testes de integração observando a interface e passando pelos handlers MSW e pelo Socket.IO reais:

1. Compra completa: carrinho → checkout → confirmar → pendente → confirmado com recibo; o carrinho perde só as quantidades compradas.
2. Linha acrescentada ao carrinho enquanto o pedido está pendente permanece após a confirmação.
3. Recusa: motivo exibido, carrinho intacto, estoque liberado, "Voltar ao checkout".
4. Cliques repetidos rápidos e duas abas com a mesma chave: um único pedido.
5. Timeout depois de o servidor criar o pedido (resposta perdida): a nova tentativa com a mesma chave recupera o mesmo pedido.
6. Mesma chave com corpo diferente: 409, verificado na API.
7. Cotação alterada entre a revisão e o envio (preço, esgotamento, cupom expirado, cotação expirada): 409 no servidor e nova confirmação na interface.
8. Refresh na página do pedido pendente e refresh no checkout durante o envio: recuperação sem duplicar.
9. Desconexão e reconexão do socket com pedido pendente: reconciliação por REST mostra o estado correto.
10. `order.updated` duplicado, antigo e de estado terminal não regridem. Evento destinado a outro usuário **não chega** à conexão de outro usuário (verificado no tráfego do socket, não só na interface).
11. Recibo imutável: mudança de preço e de nome do NFT depois da confirmação não altera o recibo.
12. Pedido de outro usuário: 403 na API e página com erro adequado.
13. Expiração da sessão com pedido pendente: novo login e retorno à página do pedido.
14. Teclado, foco e anúncios nos três estados; "Ver no Etherscan" informa indisponibilidade.
15. As pendências da seção 6.

Execute os fluxos principais em Chromium desktop e mobile. Crie referências visuais do recibo confirmado (desktop e mobile), com dados, fontes e relógio estáveis. Inspecione-as e compare com o frame antes de aceitar.

Execute tipos, lint (inclui `check:bom`), formatação, build, build de integração, testes de integração e E2E, com o limite de workers configurado. **Não execute o Lighthouse nesta etapa.**

**Fique atento a erros de infraestrutura** ("Target crashed", navegador fechado, timeout do servidor de pré-visualização, falta de memória, processo encerrado). Registre cada ocorrência em `docs/orders-verification.md` com teste, condição e resultado ao repetir. Investigue as repetições em vez de escondê-las com retentativas. Ao final, confirme que não ficaram navegadores nem servidores de pré-visualização órfãos.

## 9. Documentação e entrega

Atualize README, arquitetura, contratos, eventos e cenários em pt-BR. Inclua:

- persistência, versão e comparação de cotações no servidor;
- idempotência: geração, armazenamento e descarte da chave, comparação canônica, respostas;
- estados do pedido, resolução que sobrevive ao reload, reserva e liberação de estoque, redução do carrinho exatamente uma vez;
- autenticação do socket, entrega por sessão e como isso evita exposição entre usuários;
- recuperação após refresh, timeout e reconexão;
- recibo imutável e o formato da referência de transação simulada;
- decisões e desvios do Figma (página em vez de modal, estados pendente e recusado, recibo discriminado, "Ver no Etherscan");
- cenários novos e como reproduzir pagamento recusado e timeout depois da criação, como pede o requisito para o README;
- evidências executadas e o que não foi verificado.

Ao concluir, informe arquivos alterados, fluxos entregues, resultados dos testes e eventuais desvios visuais. Não declare o desafio inteiro concluído.

**Pare após pedidos, pagamento simulado e recibo. Não avance para perfil, edição de carteiras, favoritos, desempenho, commit, push ou deploy sem nova autorização.**
