# Correções da revisão: pedidos

## Objetivo

Corrigir dois pontos encontrados na revisão do commit `012829a` (pedidos, pagamento simulado e recibo). É uma rodada curta, sem funcionalidades novas e sem mudanças visuais além das mensagens descritas.

Fora desta rodada: a otimização do temporizador de resolução de pagamentos (reservada para a etapa de desempenho), perfil, carteiras e favoritos.

## Ponto de partida e referências

- Repositório: https://github.com/Moharu/frontend-challenge
- Último commit revisado: `012829a`.
- Handoff da etapa: `docs/handoffs/coding-agent-orders-draft-pt-br.md`.
- Documentação da etapa: `docs/orders.md`, `docs/orders-verification.md`, `docs/cart.md` e `docs/contracts/rest.md`.

Inspecione o checkout atual antes de editar e preserve trabalho mais recente. Não crie commit, push ou deploy sem autorização separada.

## 1. Pedido duplicado a partir de outra aba

**Problema.** A chave de idempotência fica em `sessionStorage`, que é separado por aba. Uma segunda aba que confirma o mesmo carrinho enquanto o primeiro pedido está pendente gera uma chave nova, e a cotação continua válida, porque o carrinho só é reduzido na confirmação. O servidor cria um segundo pedido e reserva estoque de novo. `docs/orders.md` registra isso como limitação, mas evitar pedidos duplicados é requisito explícito do desafio.

**Correção esperada.**

- **No servidor simulado,** no máximo **um pedido pendente por carrinho**. Ao receber `POST /orders` com uma chave nova para um carrinho que já tem pedido pendente do mesmo usuário, responda 409 com código próprio (por exemplo `ORDER_PENDING`) e o id do pedido existente na resposta. Não crie outro pedido nem reserve estoque.
- A verificação da chave de idempotência continua vindo **antes** dessa regra: a mesma chave com o mesmo corpo segue devolvendo o mesmo pedido (200), inclusive na aba original e após timeout.
- Quando o pedido pendente chega a estado terminal, o carrinho volta a aceitar um novo pedido: depois da confirmação, com o carrinho já reduzido; depois da recusa, com o carrinho intacto.
- **No cliente,** ao receber `ORDER_PENDING`, leve o usuário à página do pedido existente com uma mensagem acessível ("Já existe um pedido em andamento para este carrinho."), sem mostrar erro genérico. Descarte a chave pendente da aba que recebeu o 409.
- Atualize `docs/contracts/rest.md` (novo código e resposta), `docs/orders.md` (regra e remoção da limitação) e o contrato de erros em `src/contracts`.

**Testes.**

1. Duas abas com chaves diferentes confirmando o mesmo carrinho: um único pedido; a segunda aba é levada ao pedido existente.
2. A mesma chave com o mesmo corpo continua devolvendo o mesmo pedido, inclusive após resposta perdida.
3. Depois da recusa, um novo pedido para o mesmo carrinho é aceito.
4. Verificação direta na API do 409 `ORDER_PENDING` com o id do pedido existente.

## 2. "Esgotado" falso no carrinho do próprio comprador

**Problema.** A reserva do pedido pendente reduz `available` para todos, inclusive para o carrinho de quem fez o pedido. Ao comprar uma edição única (disponibilidade 1), a linha do carrinho do comprador mostra "Esta edição esgotou. Remova o item" até o pagamento resolver. O mesmo acontece sempre que a quantidade reservada é maior que a metade da disponibilidade. Com o atraso padrão o intervalo é curto, mas fica visível em outra aba ou com pagamento mais lento.

**Correção esperada.**

- Ao calcular a disponibilidade de uma linha do carrinho de um usuário (`viewCart`, cotação e validação de quantidade), **some de volta as quantidades reservadas pelos pedidos pendentes desse próprio usuário** para a mesma edição. Para os demais usuários e visitantes, a disponibilidade continua reduzida pela reserva.
- Enquanto há pedido pendente para o carrinho, mantenha-o coerente com a regra da seção 1. A interface pode indicar no carrinho que há um pedido em andamento, com link para a página do pedido, sem bloquear a visualização.
- O evento `nft.updated` emitido na reserva continua refletindo a disponibilidade pública. O carrinho do comprador é recalculado por REST, sem cálculo no cliente.
- Documente a regra em `docs/cart.md` e `docs/orders.md`.

**Testes.**

1. Comprar uma edição única com pagamento pendente: o carrinho do comprador não mostra conflito, e a disponibilidade pública mostra 0 para outro usuário ou visitante.
2. Depois da confirmação, a linha sai do carrinho; depois da recusa, a disponibilidade volta para todos.

## 3. Verificação e entrega

Execute tipos, lint (com `check:bom`), formatação, build, build de integração, testes de integração de carrinho, checkout e pedidos e o E2E, com o limite de workers configurado. **Não execute o Lighthouse.**

**Fique atento a erros de infraestrutura** ("Target crashed", navegador fechado, timeout do servidor de pré-visualização, falta de memória, processo encerrado) e a falhas que só aparecem na suíte completa. Registre cada ocorrência em `docs/orders-verification.md` com teste, condição e resultado ao repetir, e investigue a causa em vez de usar retentativas. Ao final, confirme que não ficaram navegadores nem servidores de pré-visualização órfãos.

Registre esta rodada em `docs/orders-verification.md`. Ao concluir, informe arquivos alterados, como cada ponto foi resolvido e os resultados dos testes.

**Pare após estas correções. Não avance para perfil, carteiras, favoritos, desempenho, commit, push ou deploy sem nova autorização.**
