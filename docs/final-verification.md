# Verificação final

Etapa guiada por `docs/handoffs/coding-agent-final-draft-pt-br.md`, a partir de `cc99ff5`.

## Defeitos da revisão independente

Cada defeito tem um teste que falhou antes da correção (verificado guardando só a correção com `git stash` e rodando o teste) e passou depois, mantido como regressão. Todos em desktop e mobile.

| #   | Defeito                                                                        | Reprodução (falha antes)                                                                                                                                 | Correção                                                                                                                              | Teste                                                                       |
| --- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | Mutations da conta enviadas como o próximo usuário (favoritos)                 | Ada favorita, desfavorita e favorita com a primeira requisição atrasada; Lin entra no meio. Antes: um segundo `POST /favorites` saía com a sessão de Lin | Cada requisição da fila vai com a identidade capturada no clique (`addFavorite(nftId, identity)`), e a fila para quando o escopo muda | `account.spec.ts` 14                                                        |
| 1   | O mesmo no "Salvar" do perfil                                                  | Dados, avatar e senha com a escrita atrasada; troca de usuário durante o primeiro passo. Antes: `PUT /profile/avatar` era enviado para a conta de Lin    | Os três passos levam a identidade capturada no "Salvar"; os seguintes param quando ela muda                                           | `account.spec.ts` 15                                                        |
| 2   | Aplicar filtros não reiniciava a paginação                                     | Em `/?page=2`, aplicar Solana (barra lateral e drawer). Antes: a URL mantinha `page=2`                                                                   | `change()` sempre usa a página 1; só a paginação usa `goToPage`                                                                       | `discovery.spec.ts` "aplicar filtros a partir da página 2 volta à página 1" |
| 3   | Expiração apagava a tentativa de pedido não resolvida                          | Resposta perdida, expiração, "Tentar novamente" com 401. Antes: a chave sumia do `sessionStorage` e, depois do login, o checkout não retomava            | O 401 preserva a tentativa; o checkout a retoma com a mesma chave depois de entrar de novo                                            | `orders.spec.ts` 19                                                         |
| 4   | Falha de rede nos dados do perfil apagava as edições quando o avatar era salvo | `failNext("network")` no passo de dados, avatar salvo. Antes: o nome digitado voltava ao valor antigo                                                    | Com os dados falhando, por qualquer motivo, os campos de dados mantêm o que foi digitado                                              | `account.spec.ts` 16                                                        |
| 5   | "Tentar novamente" sem efeito quando o `sessionStorage` não grava              | `setItem` lançando erro para a chave do pedido. Antes: o botão não fazia nada                                                                            | Cópia em memória da tentativa, sempre consultada primeiro; sem tentativa, o botão confirma de novo do início                          | `orders.spec.ts` 20                                                         |
| 6   | Sessões revogadas continuavam recebendo `order.updated`                        | Quatro sessões de Ada com socket: logout em outra aba, expiração, revogação pela troca de senha e uma ativa. Antes: as três encerradas recebiam o evento | O mock confere a sessão de cada conexão antes de cada entrega privada e desautentica as encerradas                                    | `orders.spec.ts` 21                                                         |

**Revisão das demais sequências privadas (defeito 1):** o carrinho já envia cada requisição com a identidade de quem a iniciou (`data/cart/api.ts`); carteiras fazem uma requisição imediata, agora também com a identidade capturada; checkout e pedidos fazem requisições imediatas, e a única reenviada mais tarde, a tentativa do pedido, é descartada no logout e na troca de usuário.

## Pendências das revisões anteriores

1. **Eventos privados para sessões revogadas:** corrigido (defeito 6).
2. **Comentário desatualizado** em `src/routes/account.tsx`: atualizado (o menu mobile abre sobreposto).
3. **Escape nos diálogos aninhados (opcional):** não corrigido; registrado como limitação em [acessibilidade](accessibility.md#limitação-conhecida) e em `ARCHITECTURE.md`.
4. **Checkout com pedido pendente (opcional):** o checkout mostra o mesmo aviso do carrinho com "Acompanhar pedido" (`orders.spec.ts` 18).

## Acessibilidade

Ver [acessibilidade](accessibility.md). Correções: `h1` do carrinho desktop, link sublinhado no login e cadastro mobile, `id="main"` na página inexistente. A interface do carrinho desktop não muda visualmente (referência visual igual).

## Testes

- **Sem esperas fixas:** quatro `waitForTimeout` anteriores foram trocados por sinais determinísticos (contadores do cliente Socket.IO da página, contadores de requisições do simulador ou dois quadros de animação). Ver [testes](testing.md#isolamento-e-tempo).
- **Comando único:** `npm test`.

Resultados no checkout de trabalho, com 2 workers:

| Verificação                                | Resultado                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Tipos, lint (com `check:bom`) e formatação | Aprovados                                                                                         |
| Build e build de integração                | Aprovados                                                                                         |
| Integração                                 | 207 aprovados, 5 pulados (2 de etapas anteriores e 3 de acessibilidade que rodam em um só perfil) |
| E2E                                        | 14 aprovados (referências visuais inalteradas)                                                    |

## Tailwind

Pedido do usuário: usar Tailwind sempre que possível. 582 declarações de 204 regras de classe única (129 regras removidas por inteiro) passaram para classes utilitárias nos elementos; `globals.css` caiu de 3.562 para 2.720 linhas. Critérios da conversão, para não mudar a aparência:

- só regras `.classe { … }` no topo ou em `@media` de largura e de movimento reduzido, viradas em variantes (`max-width: 700px` → `max-[701px]:`, porque o Tailwind v4 usa `<`);
- só classes escritas em `className="…"` de elementos HTML (não em componentes, que juntam outras classes);
- uma propriedade só sai do CSS se todas as declarações dela, em todas as larguras, se convertem, e se nenhuma outra regra (lista de seletores, descendente, estado) ou outra classe do mesmo elemento declara a mesma família (`padding` e `padding-inline`, `font` e `font-weight`), porque o CSS próprio, sem camada, venceria os utilitários.

**Verificação:** estilos computados de cada propriedade convertida, antes e depois, em 1440, 1050, 900, 768 e 390 px, em cerca de 35 estados por largura (catálogo, busca, drawer, vazio, erro, skeleton, detalhe, inexistente, carrinho, login e cadastro com erros, checkout em cada passo, pedido pendente, confirmado e recusado, conta e carteiras): **44.419 valores comparados, nenhuma diferença**. As primeiras tentativas da conversão mostraram diferenças reais (diálogos, `rounded-0` inexistente, `background: none`, ordem entre blocos `@media`), e os critérios acima foram ajustados até zerá-las. 14 das 144 classes convertidas não apareceram nos estados capturados (avisos e estados transitórios: mudança de valores, erro de atualização do carrinho, pedido em andamento, limite de carteiras); são cobertas pelos testes funcionais. Referências visuais inalteradas; suítes completas aprovadas.

## Contraste, 768 px e ajustes de Figma

Pedidos do usuário depois da aprovação parcial:

- **Contraste:** verificado e corrigido. Detalhes em [acessibilidade](accessibility.md#contraste).
- **768 px:** todos os grupos de integração rodam também a 768 px (projetos `*-tablet`), sem falhas.
- **Barra de filtros conforme o Figma:**
  - contagens reais pelas facetas da API, cada uma calculada sem o filtro da própria dimensão;
  - nova faceta `price` com os limites do controle deslizante;
  - coleção e rede aplicadas ao clicar;
  - Aplicar só para a faixa de preço.
- **Detalhe conforme o Figma:**
  - estrelas e contagem de avaliações;
  - linha de compra só com Comprar e Favoritar ("Adicionar ao carrinho" removido a pedido do usuário);
  - metadados em linha e ícones de compartilhamento;
  - removida a barra laranja que o painel aberto das abas recebia por engano (o seletor de aba ativa também atingia o painel).
- **Cartões no desktop:** carrinho, coração e lupa aparecem no hover ou no foco.
- **Login e cadastro conforme o Figma:** ícones de olho e sociais, layout centralizado.
- **"Limpar filtros":** na barra lateral, aplica na hora.
- **Teste de contraste:** a área medida passou a conter só o texto, sem ícones vizinhos, e a rolagem até o elemento é instantânea. Assim nenhuma captura sai no meio de uma rolagem suave de carrossel. Estável em três repetições.

Referências visuais atualizadas depois de inspecionar as diferenças. Testes que usavam "Adicionar ao carrinho" passaram a usar Comprar.

Resultado: E2E 14 aprovados; integração 302 aprovados e 9 pulados (testes de perfil único). A suíte completa rodou com 300 aprovados; depois disso entrou o teste "Limpar filtros aplica na hora", que roda só em desktop e tablet, e o grupo de descoberta foi executado de novo (23 aprovados, 1 pulado).

## Clone limpo

Diretório novo (`/tmp/kurio-clean`): `git clone` do repositório em `cc99ff5` com as mudanças desta etapa aplicadas, sem `node_modules` nem builds; Node 24.22.0 e npm 11.19.1.

| Comando                                                     | Resultado                                              |
| ----------------------------------------------------------- | ------------------------------------------------------ |
| `npm ci` e `npx playwright install chromium`                | Aprovados                                              |
| `npm run typecheck`, `npm run lint`, `npm run format:check` | Aprovados                                              |
| `npm test` (build, E2E, build de integração e integração)   | E2E 14 aprovados; integração 207 aprovados e 5 pulados |
| `npm run test:a11y`                                         | 9 aprovados, 3 pulados (testes de um só perfil)        |

Sem processos órfãos ao final.

## Erros de infraestrutura

Nenhum ("Target crashed", navegador fechado, timeout do servidor de pré-visualização, falta de memória ou processo encerrado), inclusive na suíte completa. Sem navegadores, servidores de pré-visualização ou perfis temporários órfãos ao final de cada execução.
