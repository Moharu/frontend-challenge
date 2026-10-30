# Pedidos, pagamento simulado e recibo

Etapa guiada por `docs/handoffs/coding-agent-orders-draft-pt-br.md`. "Confirmar compra" cria um pedido idempotente a partir da cotação revisada; o pagamento é simulado no servidor; a página `/orders/$orderId` acompanha `pending → confirmed | declined` e mostra o recibo imutável. A etapa termina aqui: histórico de pedidos, perfil e edição de carteiras continuam fora. Contratos em [REST](contracts/rest.md#pedidos-implementados) e [eventos](contracts/events.md#autenticação-do-socket-e-entrega-privada).

## Envio pelo checkout

- **Chave de idempotência:** `src/data/orders/pending.ts` guarda em `sessionStorage` (`kurio.checkout.order.v1:<userId>`) `{ key, canonical, body, orderId }`. A mesma compra (mesmo corpo canônico) reutiliza a chave; outro corpo gera uma chave nova (UUID). A entrada é descartada quando o pedido chega a um estado terminal, no logout e na troca de usuário (`discardDrafts`).
- **Cliques repetidos e duas abas:** o botão fica ocupado durante o envio, e qualquer envio repetido usa a mesma chave; o servidor devolve o mesmo pedido.
- **Falha sem resposta** (rede ou 5xx): "Não foi possível confirmar o envio do pedido." com "Tentar novamente", que reenvia a mesma chave e o mesmo corpo. Se o pedido já tinha sido criado, a resposta é esse pedido.
- **Refresh durante o envio:** ao montar, o checkout encontra a entrada sem `orderId` e retoma o envio ("Retomando seu pedido…") com a mesma chave. Uma entrada com `orderId` não é retomada (é uma compra já criada).
- **Respostas:** sucesso grava o `orderId` e substitui a URL pela do pedido; `QUOTE_CHANGED` descarta a chave e passa a cotação nova pela comparação do checkout; 400 mostra os campos no formulário; 409 `CONFLICT` descarta a chave e informa o erro.

## Página do pedido

- Rota protegida por `requireSession`, lazy; acesso direto e refresh funcionam. Sessão expirada leva ao login e volta à página do pedido.
- Consulta `["order", escopo, id]` no escopo privado do usuário. A regra `newerOrder` nunca aceita versão menor e nunca sai de um estado terminal, venha a atualização de REST ou de `order.updated`. Reconexão do socket e retorno à aba reconciliam por REST.
- **Pendente:** "Aguardando confirmação da rede", barra de progresso (estática com `prefers-reduced-motion`) e o aviso de que é possível sair e voltar: a resolução acontece no servidor.
- **Confirmado:** recibo com referência da transação, data, carteira e rede, itens (nome, edição, `tokenId`, quantidade, preço unitário e da linha), subtotal, desconto (só quando houve), taxa e total, todos do snapshot. "Ver no Etherscan" informa indisponibilidade (a referência é simulada).
- **Recusado:** motivo, a informação de que o carrinho foi preservado e "Voltar ao checkout".
- Em estados terminais, a entrada da chave é descartada e o carrinho é buscado de novo (a confirmação já reduziu as quantidades no servidor).
- **Acessibilidade:** a transição é anunciada por uma região `aria-live` e o foco vai ao título; a tabela de itens usa cabeçalhos de linha; 403 mostra "Este pedido pertence a outra conta" e 404 "Pedido não encontrado".

## Pendências resolvidas

- `<p>` dentro do `<dl>` do resumo do checkout: as notas (cupom removido, rede) saíram da lista de definição.
- Cupom expirado removível no carrinho e no checkout (decisão em [carrinho](cart.md)).

## Decisões e desvios do Figma

- **Página em vez de modal:** o frame "Confirmação de Pedido" é um modal sobre o checkout; aqui é uma página (`/orders/$orderId`), para sobreviver a refresh, ter link direto e retomar depois do login. O botão de fechar do frame volta ao catálogo.
- **Mobile em tela cheia (orientação do usuário):** até 700px a página do pedido mostra só o cartão, ocupando a tela como o login e o cadastro, sem cabeçalho, rodapé nem navegação inferior; o × volta ao catálogo.
- **Estados pendente e recusado:** não existem no Figma; seguem o cartão do recibo.
- **Recibo detalhado:** o frame mostra só o resumo; o recibo acrescenta a tabela de itens e os valores, exigidos pelo handoff.
- **Ilustração "THANK YOU":** o asset não foi exportado do arquivo; o envelope é redesenhado em SVG decorativo, na cor de destaque.
- **Desktop conforme o frame `11:4385`** (captura fornecida pelo usuário): cartão de 698px sem cantos arredondados, faixa de dados com linhas cobre de ponta a ponta, tabela sem divisórias entre linhas, quantidade "(x N)", subtotais em cobre, totais na metade direita e barra inferior grossa. A carteira mostra o provedor ("MetaMask"); o endereço completo fica para leitores de tela.
- **Diferenças mantidas:** a data segue o formato pt-BR ("29 de jul. de 2026", não "29 Jul, 2026"); o recibo inclui Subtotal (e Desconto, quando houve) além de taxa e total, e a edição ("1/20") ao lado do ID do token, conforme o handoff.
- **"Ver no Etherscan":** diálogo de indisponibilidade, porque a referência é simulada.
- **Autenticação do socket por evento:** a integração MSW 0.2.0 não expõe o `auth` da negociação; ver [eventos](contracts/events.md).

## Limitações

- Pagamento simulado (sem rede real); o resultado e o atraso vêm de cenários.
- A chave fica em `sessionStorage`: uma segunda aba criada depois do envio não conhece a chave da primeira, mas, enviando o mesmo corpo, uma nova chave criaria outro pedido. O teste de duas abas cobre a mesma chave compartilhada.
- Não há histórico de pedidos nem cancelamento.
