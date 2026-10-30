# Correções da documentação: coerência final

## Objetivo

Corrigir afirmações desatualizadas ou contraditórias encontradas numa revisão de coerência de toda a documentação, feita depois da etapa final (`1bdbdb5`). README, `ARCHITECTURE.md` (exceto os pontos abaixo) e `docs/requirements-traceability.md` estão coerentes com o código.

**Somente documentação.** Não altere código, testes, configurações nem referências visuais. Não rode Lighthouse.

## Ponto de partida e referências

- Repositório: https://github.com/Moharu/frontend-challenge
- Último commit revisado: `1bdbdb5`, publicado em produção.
- Fonte da verdade para o estado final: o código, `README.md`, `docs/requirements-traceability.md`, `docs/final-verification.md` e `docs/deploy-verification.md` (seção "Etapa final").

Inspecione o checkout atual antes de editar e preserve trabalho mais recente. Commit e push exigem autorização do usuário; o push reimplanta o site, sem mudança de código.

## Regra geral

Cada documento descreve o **estado final**, exceto os registros explicitamente históricos (diário de IA e verificações de etapa, ver item 9). Ao corrigir, confira a afirmação no código antes de reescrevê-la; não copie de outro documento sem verificar.

## 1. Filtro de preço

- `ARCHITECTURE.md`, tabela "Desvios do Figma": a linha "Campos de preço digitáveis no lugar do controle decorativo" está desatualizada. A etapa final implementou o controle deslizante de dois marcadores (`role="slider"`), descrito em `docs/discovery.md` linha 46.
  - Remova ou reescreva a linha conforme o comportamento atual.
  - Confira também a linha "drawer com Aplicar/Cancelar/Limpar" contra o comportamento atual da barra lateral e do drawer (coleção e rede aplicadas ao clicar; Aplicar só para a faixa de preço, segundo `docs/final-verification.md`).
- `docs/discovery.md` linha 50 contradiz a linha 46 do mesmo arquivo. Remova a afirmação sobre campos digitáveis e alinhe a seção de desvios.

## 2. Situação da revisão visual

`ARCHITECTURE.md` linha 96 diz que a revisão visual "é feita pelo usuário; ajustes que ela gerar ficam para outra rodada". A revisão foi feita e aprovada pelo usuário, e os ajustes estão em `docs/final-verification.md`. Alinhe com `docs/requirements-traceability.md`.

## 3. `docs/session.md`

- Linha 24: "`requireSession` está pronto para as rotas privadas das próximas etapas". Descreva o uso atual (checkout, pedidos, conta).
- Linha 25: "'Meu perfil' e 'Carteiras' usam o aviso de indisponibilidade". Hoje levam às rotas da conta; corrija. Confira o resto da descrição do cabeçalho e da folha "Minha conta" no mobile.
- Linha 14 (redefinir o estado): lista só as chaves do `localStorage`. Alinhe com a lista completa do README (inclui as chaves de `sessionStorage` do rascunho do checkout e da tentativa de pedido) ou remeta ao README.
- Confira se a linha 76 continua coerente depois dessas mudanças.

## 4. `docs/mock-scenarios.md`

A seção "Estado persistido de referência" diz `schemaVersion: 4` e "Não existe estado de perfil, carteira ou pedido", enquanto as seções de extensão do mesmo arquivo e `ARCHITECTURE.md` dizem versão 7, com carteiras, conexões, cotações, pedidos, perfil e favoritos.

- Atualize a seção principal para descrever o retrato atual (versão 7 e todas as coleções).
- Mantenha as seções de extensão como histórico identificado ou consolide-as, sem deixar contradições.
- Revise também o primeiro parágrafo do arquivo ("A interface de descoberta consulta…"), que descreve só a descoberta.

## 5. Cabeçalho de `docs/deploy-verification.md`

As linhas 6 e 7 dizem que o último commit e a última implantação verificados são `56365d3` e `dpl_7pNttnhA25to6uWZwC9SDAb5n9yM`. A seção "Etapa final" do mesmo arquivo e o README dizem `b7be43c` (`dpl_Gp7KNVYYkQ51vpYyormTn3ALfYo8`). Atualize o cabeçalho para a última verificação e mantenha o histórico nas seções correspondentes.

## 6. Botão "Adicionar ao carrinho" removido do detalhe

- `docs/discovery.md` linha 72 ainda diz que "comprar e adicionar ao carrinho agora são ações reais" no detalhe. O botão foi removido por decisão do usuário; atualize.
- `docs/cart.md` (seção do detalhe) diz "como no Figma, só Comprar e Favoritar". Vale para o desktop, mas o frame mobile do detalhe (`15:5536`) tem uma ação de carrinho separada. Registre a decisão do usuário como desvio no mobile em `docs/cart.md` e acrescente uma linha na tabela "Desvios do Figma" de `ARCHITECTURE.md`. Mencione que adicionar ao carrinho continua possível pelo "Comprar" e pelo ícone de carrinho dos cartões.

## 7. Tempo futuro desatualizado

`docs/cart.md` linha 19: "o checkout deverá revalidar tudo na cotação". O checkout já revalida; reescreva no presente com link para `docs/checkout.md`. Procure outras ocorrências de "deverá", "próxima etapa", "etapas futuras" ou "ainda não" nos documentos de estado atual (README, `ARCHITECTURE.md`, `docs/*.md` por área, contratos, testes, acessibilidade, desempenho e rastreabilidade) e corrija as que não forem mais verdadeiras.

## 8. Caminho dos relatórios do Lighthouse

`docs/discovery.md` linha 93 aponta os relatórios para `reports/lighthouse/{mobile,desktop}`. Os relatórios oficiais estão em `docs/lighthouse/` e a análise em `docs/performance.md`. Atualize ou remeta a eles.

## 9. Registros históricos identificados

As verificações de etapas anteriores contêm afirmações verdadeiras quando escritas e que hoje parecem atuais, por exemplo "desempenho mobile abaixo da meta" em `docs/discovery-verification.md` e `docs/cart-verification.md`.

- No topo de cada um destes arquivos, acrescente uma linha curta dizendo que é um registro histórico da etapa e onde está o estado atual (README, `docs/final-verification.md`, `docs/performance.md`, `docs/requirements-traceability.md`, conforme o caso): `docs/discovery-verification.md`, `docs/cart-verification.md`, `docs/session-verification.md`, `docs/checkout-verification.md`, `docs/orders-verification.md` e `docs/account-verification.md`.
- Não reescreva o conteúdo histórico.
- `docs/bootstrap-scope.md` recebe a mesma linha.
- O diário de IA já é datado e não precisa de mudança.

## 10. Verificação e entrega

- Rode `npm run format:check` e `npm run lint` (inclui `check:bom`).
- Confira que todos os links internos alterados apontam para arquivos e âncoras existentes.
- Faça uma última busca pelas afirmações corrigidas (por exemplo "campos de preço digitáveis", "schemaVersion: 4", "próximas etapas", "56365d3" fora do histórico, "adicionar ao carrinho") e confirme que não restou contradição.
- Registre esta rodada em `docs/final-verification.md` de forma breve.
- Peça autorização ao usuário antes do commit e do push. Depois do push, confirme na Vercel que a produção está no novo commit; como não há mudança de código, não é necessário repetir `test:deploy` nem o Lighthouse.

Ao concluir, informe os arquivos alterados e, para cada item acima, o que mudou.

**Pare após estas correções. Não altere código nem avance para outra tarefa sem nova autorização.**
