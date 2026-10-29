# Correções da revisão: carrinho do visitante

## Objetivo

Corrigir três pontos encontrados na revisão do commit `480dbc7` (carrinho persistente do visitante). É uma rodada curta de correções, sem funcionalidades novas e sem mudanças visuais.

Fora desta rodada: autenticação, mesclagem de carrinho, checkout e os demais apontamentos da revisão, que entram nos próximos handoffs.

## Ponto de partida e referências

- Repositório: https://github.com/Moharu/frontend-challenge
- Último commit revisado: `480dbc7`.
- Handoff da etapa: `docs/handoffs/coding-agent-cart-draft-pt-br.md`.
- Documentação da etapa: `docs/cart.md`, `docs/cart-verification.md`, `docs/contracts/rest.md`, `docs/mock-scenarios.md` e `ARCHITECTURE.md`.

Inspecione o checkout atual antes de editar e preserve trabalho mais recente. Não crie commit, push ou deploy sem autorização separada.

## 1. Leitura antiga do carrinho sobrescrevendo uma alteração mais nova

**Problema.** A leitura `cart(token)` em `src/mocks/store/index.ts` executa fora da fila serializada de transações, e a proteção por versão de `storeCart` (`src/data/cart/queries.ts`) só vale para respostas de mutations. O `queryFn` do carrinho grava qualquer resposta de `GET /cart` no cache, mesmo com `version` menor que a já armazenada.

**Cenário.** O usuário clica em `+` enquanto um `nft.updated` invalida o carrinho. O `GET /cart` lê o estado antes de o `PATCH` ser gravado; se a resposta do `GET` chegar depois da resposta do `PATCH`, a quantidade volta ao valor anterior até a próxima leitura. O atraso de escrita do cenário (`cartDelay("write", ms)`) torna isso reproduzível.

**Correção esperada.**

- No servidor simulado, faça as leituras do carrinho passarem pela mesma fila das escritas, para que uma leitura nunca observe um estado anterior a uma escrita já enfileirada.
- No cliente, nunca substitua no cache um carrinho do mesmo `id` com `version` menor que a atual, seja a resposta de mutation ou de leitura. Use uma única regra para os dois caminhos.
- Um carrinho com `id` diferente (novo visitante) continua substituindo o anterior.

**Teste.** Adicione um caso de integração que reproduza o cenário acima com atraso de escrita e evento real `nft.updated`, verificando que a quantidade exibida nunca regride.

## 2. `ARCHITECTURE.md` desatualizado

**Problema.** As linhas que descrevem contratos e mocks ainda dizem que o retrato está em `schemaVersion` 2, que não há consistência entre abas e que somente os endpoints de NFT estão implementados. Isso contradiz o estado atual (esquema 3, carrinho implementado, recarga do retrato persistido antes de cada transação).

**Correção esperada.**

- Revise `ARCHITECTURE.md` inteiro, não apenas essas linhas, e alinhe-o ao estado atual: esquema 3, endpoints de visitante/carrinho/cupom implementados, política de múltiplas abas adotada e o que continua somente contrato (sessão, favoritos, cotação, pedidos, perfil e carteiras).
- Mantenha a seção de limitações, incluindo a rede de pagamento independente da rede do NFT.
- Confira se `docs/contracts/rest.md` e `docs/mock-scenarios.md` estão consistentes com o mesmo estado.

## 3. `fields.quantity` com número em vez de mensagem

**Problema.** Em `src/mocks/store/cart.ts`, as respostas 409 de `addItem` e `changeItem` enviam `fields: { quantity: "3" }`. O contrato define `fields` como mapa de campo para **mensagem segura**; a quantidade máxima como texto solto pode ser exibida como "3" por um consumidor futuro.

**Correção esperada.**

- `fields.quantity` passa a conter uma mensagem legível, por exemplo "É possível adicionar no máximo 3.".
- Se a interface precisar da quantidade máxima como número, exponha-a em um campo estruturado e documentado do erro (por exemplo `details.maxQuantity`), atualizando o envelope de erro em `src/contracts/common.ts` e em `docs/contracts/rest.md`. Não faça a interface interpretar texto de mensagem.
- Ajuste os testes que verificam essas respostas.

## 4. Verificação e entrega

Execute tipos, lint, formatação, build, build de integração, testes de integração e E2E. Não é necessário rodar o Lighthouse nesta rodada, pois não há mudança de carregamento.

Atualize `docs/cart-verification.md` com as evidências desta rodada. Ao concluir, informe arquivos alterados, como cada ponto foi resolvido e os resultados dos testes.

**Pare após estas três correções. Não avance para autenticação, mesclagem de carrinho, checkout, commit, push ou deploy sem nova autorização.**
