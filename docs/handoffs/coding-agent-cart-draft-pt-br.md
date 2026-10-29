# Próxima etapa: carrinho persistente do visitante

## Objetivo

Primeira etapa do fluxo de compra: catálogo → NFT → **carrinho**. Implementar o carrinho de visitante de ponta a ponta, com a mesma infraestrutura REST, Query, MSW e Socket.IO já usada pela descoberta:

- adicionar edição/quantidade a partir do detalhe;
- tela de carrinho desktop e mobile;
- quantidades limitadas por disponibilidade e limite de compra;
- remoção de itens;
- cupom;
- subtotal, desconto, taxa de rede estimada e total calculados pela API simulada;
- persistência após refresh;
- atualização de preço/disponibilidade em tempo real.

Fora desta etapa: autenticação, mesclagem do carrinho no login, favoritos persistidos, checkout, cotação de checkout, pedidos, perfil e carteiras. O botão de finalizar continua levando a um aviso honesto de indisponibilidade (seção 7).

## Ponto de partida e referências

- Repositório: https://github.com/Moharu/frontend-challenge
- Último commit revisado: `63dbad2` (descoberta pública).
- Requisitos: `docs/challenge-requirements.md`.
- Contratos e decisões existentes: `ARCHITECTURE.md`, `docs/contracts/rest.md`, `docs/contracts/events.md`, `docs/mock-scenarios.md`, `docs/discovery.md` e `docs/discovery-verification.md`.
- Figma autorizado para consulta nesta etapa: https://www.figma.com/design/Zbw0vAAPU80HoDwKVfAcCR/Frontend-Challenge--Copy-?node-id=0-1
- Implantação: Vercel. Não implantar nesta tarefa.

Inspecione o checkout atual e as instruções aplicáveis antes de editar. Preserve trabalho mais recente; não resete para o commit citado. Reutilize a stack e o lockfile existentes. Não crie repositório remoto, commit, push ou deploy sem autorização separada.

## Consulta ao design

Consulte o Figma em modo somente leitura, usando contexto de design e capturas dos frames. Não altere o arquivo.

Frames desta etapa:

- Desktop / Carrinho de NFTs: `11:1278`.
- Mobile / Carrinho de NFTs: `16:360`.
- Desktop / Detalhes do NFT: `10:244` e Mobile / Detalhes do NFT: `15:5536` (somente as ações de comprar/adicionar ao carrinho).
- Cabeçalho desktop e navegação mobile dos frames de início (`2:2`, `14:5226`), para o ícone e o badge do carrinho.

Observações já verificadas, a confirmar no arquivo:

- Desktop: breadcrumb `Início / Mercado / Carrinho`; tabela com colunas NFTs, Preço, Edições e Total; linha com miniatura, nome, ID do token, preço unitário, controle −/+, total da linha e lixeira.
- Desktop: painel lateral "Resumo da carteira" com campo "Código promocional" + Aplicar, Subtotal, "Desconto do lançamento", "Taxa de rede" com legenda "Taxa estimada", Total, botão "Conectar e finalizar" e link "Continuar explorando".
- Desktop: carrossel "Colecionadores também viram" abaixo do carrinho; depois a faixa promocional e o rodapé já existentes.
- Mobile: cabeçalho próprio com botão voltar e título "Carrinho de NFTs", sem a navegação inferior; cards com arte, nome, edição, total e controle −/+; resumo fixo na parte inferior com cupom, valores e botão "Conectar e finalizar".
- Badge do carrinho no cabeçalho desktop (o `6` é ilustrativo).

Não copie posições absolutas nem fixe a altura em 896px. O resumo fixo do mobile deve reservar espaço para que o último card nunca fique escondido e deve respeitar safe areas, teclado virtual (campo de cupom) e zoom.

### Inconsistências conhecidas

- Os valores desenhados não fecham: no desktop, linhas somam 26.83 com quantidades 2/6/9, mas o badge mostra 6; no mobile, as linhas somam 8.14 ETH e o subtotal mostra 8.92. **Todos os valores vêm da API**; nada é copiado do layout.
- No mobile, a lixeira do card "Ivory Baron" sobrepõe o botão `+`. Implemente uma ação explícita de remover em cada card, sem sobreposição, com nome acessível.
- No mobile, o botão `−` aparece desabilitado com quantidade 1. Mantenha: quantidade mínima 1; remover é uma ação separada.
- "Edição: 1/50", "1/1", "1/10" são rótulos de exemplo. Use o rótulo canônico da edição vindo da API.
- "(-) 00.00" não é um formato válido. Exiba desconto zero como `0 ETH` ou `0.00 ETH`, conforme a regra de formatação da seção 1, sempre com o prefixo de subtração quando houver desconto.
- "Resumo da carteira" é o título do layout para o resumo do carrinho. Preserve o texto do Figma, a menos que se torne confuso com a seção de carteiras; registre a decisão.

## 1. Aritmética de ETH

`src/contracts/eth.ts` já valida, converte para `bigint` (10^-18), compara e normaliza. Complete o módulo para os cálculos do carrinho, sem bibliotecas novas:

- Soma, subtração com limite em zero e multiplicação por quantidade inteira.
- Percentual de desconto em pontos-base inteiros, com arredondamento **para baixo** na menor unidade (o comprador nunca recebe desconto maior que o anunciado). Documente a regra.
- Conversão de volta para `Eth` normalizado.
- Formatação de exibição separada da aritmética: ponto como separador decimal (convenção de criptoativos, igual ao Figma), mínimo de duas casas, sem perder casas significativas e sem notação exponencial. Valores longos não podem causar overflow horizontal.
- Nenhum cálculo de dinheiro pode passar por `Number`, `parseFloat` ou `toFixed`.

A mesma implementação deve ser usada pelos handlers MSW (fonte dos valores) e pela interface (somente exibição). A interface não recalcula totais; ela exibe o que a API devolveu.

Adicione testes de precisão: valores com 18 casas, somas que não fecham em ponto flutuante (por exemplo, 0.1 + 0.2), quantidade máxima, desconto com arredondamento e formatação. Use a estrutura de testes existente; se adicionar um executor de testes unitários, justifique a dependência e mantenha-a só em desenvolvimento.

## 2. Contratos do carrinho

Revise `src/contracts/cart.ts` e `docs/contracts/rest.md`. Mudanças propostas, a confirmar com as decisões abaixo:

- **Identidade do visitante:** o carrinho pertence ao servidor simulado. O cliente guarda apenas um token opaco de visitante emitido pela API e o envia em todas as requisições do carrinho, pelo Axios. O conteúdo do carrinho nunca é a fonte de verdade no armazenamento do cliente. O token deve ser preparado para a mesclagem com a sessão na próxima etapa, sem implementá-la agora.
- **Itens:** cada linha é identificada por NFT + edição; adicionar a mesma edição soma à linha existente. A linha expõe nome, arte, ID do token, rótulo da edição, preço unitário atual, total da linha, disponibilidade e limite efetivo (`min(available, purchaseLimit)`), além da versão do NFT considerada.
- **Preço:** o carrinho usa o preço atual da edição, não o preço do momento da adição. Quando o preço mudar depois da adição, a linha indica a mudança (preço anterior e atual) até o usuário reconhecer ou a linha mudar.
- **Indisponibilidade:** a API não reduz nem remove itens silenciosamente. Uma linha com quantidade acima do limite ou edição esgotada fica marcada como em conflito, com a quantidade máxima permitida, e bloqueia a finalização até ser corrigida.
- **Resumo:** o carrinho retorna `summary` com subtotal, desconto, taxa de rede estimada e total, já calculados.
- **Cupom:** aplicar e remover pelo carrinho (por exemplo `PUT /cart/coupon` e `DELETE /cart/coupon`), persistido com o carrinho. Erros com `fields.coupon` e mensagem distinguindo código inexistente e expirado. Um cupom por carrinho; aplicar outro substitui o anterior.
- **Versão:** toda alteração incrementa `version` do carrinho. Operações que dependem do estado anterior devem detectar versão desatualizada com 409, se a decisão sobre múltiplas abas (seção 3) exigir.

Atualize a tabela de acompanhamento em `docs/contracts/rest.md`, separando o que foi definido do que foi implementado e verificado.

### Decisões definidas

1. **Rede e taxa no carrinho.** No checkout, cada pedido usa uma única carteira, e a rede do pedido é a rede dessa carteira (frame Mobile / Pagamento `16:748`: "Principal" em Ethereum Mainnet, "Reserva" em Polygon). Nesta simulação, **a rede de pagamento é independente da rede de cada NFT**: o carrinho aceita NFTs de redes diferentes e qualquer carteira cadastrada pode pagar o pedido inteiro.
   - O carrinho, ainda sem carteira escolhida, exibe a taxa **estimada** para Ethereum (rede padrão), com a legenda "Taxa estimada" do Figma; o checkout recalculará com a rede da carteira selecionada.
   - Taxa fixa por pedido e por rede, definida nas fixtures: Ethereum 0.016, Polygon 0.002 e Solana 0.0005 ETH. Não é cobrada por item.
   - Registre em `ARCHITECTURE.md`, na seção de limitações, que essa é uma simplificação deliberada: em uma integração real, um NFT só pode ser adquirido na rede em que foi emitido, e um carrinho com redes diferentes exigiria restringir o carrinho a uma rede ou dividir o pedido por rede. Indique onde essa regra entraria (validação da cotação/pedido e filtro de carteiras no checkout).
2. **Cupons de demonstração.** Fixtures determinísticas:
   - `KURIO10`: 10% do subtotal, válido;
   - `LANCAMENTO`: 0.1 ETH de desconto fixo, válido; o desconto nunca ultrapassa o subtotal;
   - `KURIO15`: 15% do subtotal, **expirado**.

   A validade é avaliada pelo relógio lógico da simulação, não pelo relógio real, para manter os testes determinísticos. O desconto incide sobre o subtotal, nunca sobre a taxa de rede.
3. **Badge do carrinho.** Soma das quantidades. Sem badge quando o carrinho está vazio; acima de 99, exibe `99+`. O nome acessível do botão informa a quantidade exata (por exemplo "Carrinho, 120 itens").
4. **"Colecionadores também viram".** O README não define endpoint para recomendações. Reutilize `GET /nfts` no modo `trending`, excluindo NFTs já presentes no carrinho, sem endpoint novo. Se a lista resultante ficar vazia, oculte a seção.

Se alguma dessas decisões conflitar com o README ou o código existente, pare e reporte antes de seguir outro caminho.

## 3. Estado persistido e cenários dos mocks

- Adicione os carrinhos ao estado persistido do MSW. Decida entre ampliar o retrato existente (com nova versão de esquema) ou usar uma chave própria; em ambos os casos, `reset()` restaura carrinhos e cupons a um estado conhecido, e a mudança de esquema não apaga dados de outras partes da origem.
- Disponibilidade e preço continuam pertencendo ao catálogo. Adicionar ao carrinho **não reserva estoque** nesta etapa; documente essa regra, pois ela define o que o checkout revalida.
- **Múltiplas abas:** com escrita de carrinho, duas abas podem sobrescrever o retrato uma da outra. Antes de cada transação de escrita, recarregue o retrato persistido quando ele for mais recente que o da memória (por exemplo, pelo contador lógico). Documente o comportamento resultante. Coordenação completa entre abas continua fora do escopo.
- Novos controles de cenário, somente na estrutura de mocks/testes: falha única nas mutations do carrinho (HTTP e rede), atraso das mutations, cupom inválido/expirado e alteração de preço/disponibilidade de um item no carrinho pelo `update` existente.
- Respostas de erro seguem o envelope existente: 400 para quantidade/cupom inválidos, 404 para NFT/edição/item inexistentes, 409 para disponibilidade ou versão, 503 transitório.

## 4. Rotas e integração com o detalhe

- Rota `/cart`, seguindo as convenções do TanStack Router existente, com acesso direto e refresh funcionando, inclusive no build otimizado.
- No detalhe, **Adicionar ao carrinho** envia edição e quantidade selecionadas, mostra feedback acessível (sem diálogo bloqueante) e atualiza o badge. **Comprar** adiciona e navega para `/cart`; o checkout virá depois.
- Seleção inválida (edição esgotada ou quantidade acima do limite) não pode ser enviada; o detalhe já sinaliza esses conflitos.
- Se a soma com a quantidade já presente no carrinho ultrapassar o limite, a API responde 409 e a interface explica o máximo possível, sem alterar o carrinho.
- Remova do botão de carrinho e do badge os adaptadores de indisponibilidade da etapa anterior.

## 5. Tela do carrinho

- Desktop e mobile conforme os frames, compartilhando dados e lógica.
- Controle de quantidade com nome acessível por linha, limite mínimo 1 e máximo efetivo; durante a mutation, indique o estado pendente e evite envios concorrentes da mesma linha.
- Remover item com feedback acessível. Não é necessário confirmar a remoção; se houver desfazer, ele deve passar pela API.
- Cupom: aplicar, remover, mensagem de erro associada ao campo, e o desconto refletido no resumo retornado pela API.
- Conflitos de preço/disponibilidade visíveis por linha, com ação de correção; "Conectar e finalizar" desabilitado ou bloqueado com explicação enquanto houver conflito.
- Estado vazio não desenhado no Figma: crie-o com a linguagem visual existente, explicando que o carrinho está vazio e levando ao catálogo.
- Skeleton com shimmer preservando dimensões das linhas e do resumo, respeitando `prefers-reduced-motion`.
- Falha ao carregar com nova tentativa explícita; falha de mutation preserva o estado anterior e explica o erro.
- "Continuar explorando" e o botão voltar do mobile levam ao catálogo (ou à página anterior, quando houver histórico interno).

## 6. Tempo real

- `nft.updated` deve refletir preço e disponibilidade no carrinho, além de catálogo e detalhe. Reutilize o consumidor existente; não crie uma segunda conexão para o carrinho.
- Ao receber um evento que afete uma edição do carrinho, invalide/busque novamente o carrinho por REST. Não recalcule valores no cliente.
- Eventos duplicados ou antigos não podem regredir o carrinho. Após reconexão, o carrinho ativo é reconciliado por REST junto com as demais consultas.
- Anuncie de forma acessível, sem excesso, quando um item do carrinho mudar de preço ou disponibilidade.

## 7. Limite explícito das ações fora desta etapa

"Conectar e finalizar" usa o diálogo de indisponibilidade existente, deixando claro que o checkout ainda não está disponível. Não crie pedido, cotação, login ou carteira fictícios. Favoritar e entrar continuam com o padrão atual. Atualize a documentação dos adaptadores temporários que permanecem.

## 8. Responsividade, acessibilidade e desempenho

- Verifique 390, 414, 768 e 1440px. Em 768px, documente qual composição foi usada e por quê.
- Tabela desktop com semântica adequada (tabela ou lista com cabeçalhos associados). Cards mobile com títulos e controles nomeados.
- Foco visível, ordem de tabulação lógica e foco preservado após alterar quantidade ou remover item (para a próxima linha, ou o estado vazio).
- Mensagens de cupom e conflitos associadas aos controles; resumo atualizado anunciado sem repetir a tela inteira.
- Desempenho mobile ficou abaixo da meta na descoberta (89 / 85). Aplique a alavanca já identificada em `docs/discovery-verification.md`: iniciar o download do chunk do MSW em paralelo ao bundle principal (por exemplo, `modulepreload`). Meça antes e depois. Não remova funcionalidades ou assets para melhorar a pontuação.

## 9. Testes e verificação visual

Preserve as suítes de infraestrutura, integração e E2E existentes. Não apague verificações anteriores para acomodar fixtures.

Adicione E2E observando a interface e passando pelos handlers MSW e pelo cliente Socket.IO reais:

1. Detalhe → adicionar ao carrinho → badge atualizado (oculto quando vazio, `99+` acima de 99) → `/cart` com linha correta.
2. "Comprar" adiciona e navega para o carrinho.
3. Adicionar a mesma edição soma à linha; ultrapassar o limite retorna conflito sem alterar o carrinho.
4. Alterar quantidade, limites mínimo e máximo, remover até o estado vazio.
5. Refresh e acesso direto a `/cart` preservam o carrinho.
6. Cupons `KURIO10` e `LANCAMENTO` aplicados (incluindo desconto fixo maior que o subtotal), código inexistente, `KURIO15` expirado, substituição e remoção de cupom.
7. Precisão: subtotal e total com valores que perdem precisão em ponto flutuante.
8. Mudança de preço e esgotamento por `nft.updated` com o carrinho aberto; conflito bloqueia a finalização; evento duplicado/antigo não regride.
9. Reconexão reconcilia o carrinho por REST.
10. Falha única em mutation preserva o estado e permite nova tentativa; skeleton em resposta lenta.
11. Teclado e foco na tela do carrinho; diálogo de indisponibilidade do "Conectar e finalizar".
12. Contexto novo do navegador começa com carrinho vazio (isolamento por visitante).

Execute fluxos principais em Chromium desktop e mobile. Adicione baselines visuais versionadas do carrinho (com itens) em desktop e mobile, com fixtures, fontes e relógio estáveis. Inspecione as capturas antes de aprová-las e compare com os frames do Figma.

Execute tipos, lint, formatação, build, build de integração, testes de integração e E2E. Rode o Lighthouse nas rotas já auditadas (três medições por página/perfil, medianas, LCP, CLS, TBT) e registre a comparação com a etapa anterior. O carrinho ainda não entra na auditoria obrigatória.

## 10. Documentação e entrega

Atualize README, arquitetura, contratos e cenários em pt-BR. Inclua:

- Contrato do carrinho, identidade do visitante e regra para a futura mesclagem.
- Regras de preço atual, conflito de disponibilidade, ausência de reserva de estoque, rede/taxa do carrinho e cupons de demonstração (com os códigos no README, junto às credenciais fictícias).
- Regras de arredondamento e formatação de ETH.
- Política de múltiplas abas adotada.
- Decisões da seção 2 e desvios do Figma, incluindo a limitação de rede de pagamento independente da rede do NFT em `ARCHITECTURE.md`.
- Adaptadores de indisponibilidade que permanecem.
- Evidências executadas, resultados do Lighthouse e o que não foi verificado.

Ao concluir, informe arquivos alterados, fluxos entregues, resultados de testes e auditorias e eventuais desvios visuais. Não declare o desafio inteiro concluído.

**Pare após o carrinho do visitante. Não avance para autenticação, mesclagem de carrinho, checkout, cotação de checkout, pedidos, commit, push ou deploy sem nova autorização.**
