# Acessibilidade

Itens obrigatórios da seção 8 de `docs/challenge-requirements.md`, verificados na etapa final (`docs/handoffs/coding-agent-final-draft-pt-br.md`). Testes em `tests/integration/accessibility.spec.ts` (projetos `a11y-desktop`, `a11y-tablet` e `a11y-mobile`), com `npm run test:a11y` depois de `npm run build:integration`.

## Auditoria automatizada (axe)

Dependência de desenvolvimento `@axe-core/playwright` (só nos testes, fora do bundle): roda as regras do axe-core dentro do Playwright já usado pelo projeto, sem outra ferramenta nem navegador. Regras `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` (inclui `target-size`, alvos de 24 px) e `best-practice`, em desktop (1440 px) e mobile (390 px).

Estados auditados:

- **Visitante:** catálogo, drawer de filtros (mobile), catálogo vazio, detalhe, carrinho vazio, login, cadastro, cadastro com erros nos campos e página inexistente.
- **Colecionador:** carrinho com itens, checkout (página desktop, com e sem erros; os três passos mobile), pedido pendente, confirmado e recusado.
- **Conta:** perfil, carteiras, Lista de interesse, as quatro seções indisponíveis e o menu da conta aberto (mobile).

Sem regras excluídas. Os mesmos estados rodam também a 768 px (projeto `a11y-tablet`).

## Contraste

A regra `color-contrast` do axe está ativa. O axe não decide o contraste de texto sobre imagem, gradiente ou camadas sobrepostas e marca esses casos como incompletos. Para eles, o teste mede os pixels:

1. captura a área do texto com a cor do texto transparente, ou seja, só o que está atrás dele;
2. compara a cor do texto com cada pixel do fundo;
3. exige 4,5:1 (3:1 para texto grande) em 95% dos pixels.

Ficam de fora:

- ícones;
- elementos sem texto;
- conteúdo coberto por um diálogo modal ou por um menu aberto.

O esmaecimento na borda dos carrosséis também é ignorado na captura, porque o cartão fica legível quando rolado.

Correções:

| Onde                                 | Antes | Correção                                                                                  |
| ------------------------------------ | ----- | ----------------------------------------------------------------------------------------- |
| Descrição do hero (mobile)           | 3,4:1 | Texto na cor principal em vez da secundária, mais uma película escura de 30% sobre a arte |
| "Bem-vindo à Kurio" no hero (mobile) | 4,3:1 | A mesma película                                                                          |
| "Aplicar" do cupom (carrinho mobile) | 2,8:1 | Gradiente do botão escurecido (`#7a4a28` → `#9b6237`)                                     |

Depois das correções, nenhum texto abaixo do mínimo em 1440, 768 e 390 px.

### Violações encontradas e corrigidas

| Regra                  | Onde                                                 | Correção                                                                                                                                                                                                                                                             |
| ---------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `page-has-heading-one` | Carrinho desktop (vazio e com itens)                 | O `h1` "Carrinho de NFTs" existia só no cabeçalho mobile, oculto com `display: none` no desktop. No desktop ele fica visualmente oculto (a trilha é o título visível, como no Figma), sem o botão Voltar; a aparência não muda (referência visual do carrinho igual) |
| `link-in-text-block`   | Login e cadastro mobile ("Já tem uma conta? Entrar") | O link era distinguido só pela cor; agora é sublinhado (estado não dependente só de cor)                                                                                                                                                                             |
| `region`, `skip-link`  | Página inexistente                                   | O `main` não tinha `id="main"`, alvo do link "Pular para o conteúdo"; o link apontava para nada e ficava fora de um marco                                                                                                                                            |

Depois das correções, nenhuma violação em nenhum estado.

## Teclado

Roteiro automatizado no desktop (teste "teclado: entrar, favoritar, comprar até o recibo, editar perfil e carteira"), só com Tab, Shift+Tab, Enter e digitação, conferindo em **cada** controle focado que `:focus-visible` se aplica e há contorno ou sombra visível:

1. Login: o diálogo foca o e-mail; Tab até "Senha"; Enter envia.
2. Catálogo: Tab até "Favoritar Emerald Ape #042"; Enter favorita e o foco fica no botão (agora "Remover … dos favoritos"); Shift+Tab volta ao link do cartão (que vem antes do coração); Enter abre o detalhe.
3. Detalhe: Tab até "Comprar NFT"; Enter adiciona ao carrinho e o abre.
4. Carrinho: Tab até a finalização; Enter abre o checkout.
5. Checkout: Tab até "Confirmar compra"; Enter cria o pedido; o recibo confirmado chega pelo socket.
6. Perfil: Tab até "Nome de exibição", edição e Tab até "Salvar"; o resumo anuncia "Dados do perfil: salvos.".
7. Carteiras: Tab até "Apelido da carteira", edição e "Salvar carteira".

Resultado: todos os controles alcançados na ordem visual, foco sempre visível, sem armadilhas fora dos diálogos. Testes de teclado anteriores continuam cobrindo foco em diálogos e drawers (Escape, foco preso, retorno do foco), grupos de rádio do checkout, quantidade do carrinho, menu da conta e mostrar senha ([testes](testing.md), grupo 11).

## Zoom e reflow

WCAG 1.4.10: largura de 320 px, equivalente a 1280 px com 400% de zoom (mais exigente que os 200% pedidos). Teste "reflow a 320 px" em catálogo, detalhe, carrinho, os três passos do checkout, perfil e carteiras: sem rolagem horizontal da página, nenhum elemento além da borda (exceto o conteúdo de carrosséis com rolagem horizontal própria, como "Colecionadores também viram", que cabe na largura) e as barras fixas do mobile dentro da tela. Resultado: aprovado.

## Movimento reduzido

Com `prefers-reduced-motion: reduce`: o shimmer dos skeletons para (`animation: none`), a barra de progresso do pedido para, a rolagem suave vira `auto`, e a rolagem do carrossel do carrinho usa `behavior` conforme a preferência. Não há transições CSS. Teste "movimento reduzido": aprovado.

## Semântica, nomes e feedback

- **Marcos:** `header`, `nav` (principal, navegação mobile, trilha, "Meu perfil", paginação), `main` com `id="main"` em todas as rotas e `footer` (exceto nas páginas da conta, sem rodapé por decisão do usuário). O link "Pular para o conteúdo" é o primeiro foco.
- **Nomes acessíveis:** botões de ícone (carrinho, filtros, voltar, coração, mostrar senha) e imagens relevantes têm nome; imagens decorativas têm `alt=""`. Campos com `<label>` associado, inclusive quando o rótulo é visualmente oculto.
- **Erros:** `aria-invalid` e `aria-describedby` ligam cada campo à mensagem; o foco vai ao primeiro campo inválido.
- **Feedback:** `Notices` (`role="status"`) anuncia mutations (carrinho, favoritos, perfil, carteiras) e mudanças em tempo real (preço e disponibilidade no carrinho e no checkout); estados do pedido e da conexão têm regiões de status próprias.

## Não verificado

- **Leitor de tela:** sem passada manual com NVDA, VoiceOver ou TalkBack nesta etapa. Nomes, papéis, marcos e regiões de status foram conferidos pelo axe e pelas consultas por papel e nome dos testes, o que não substitui ouvir a leitura.
- Navegadores além do Chromium e dispositivos físicos.

## Limitação conhecida

Escape no login pressionado antes de o aviso de indisponibilidade (por exemplo, "Entrar com Google") terminar de abrir fecha os dois diálogos: o Radix só encaminha o Escape a uma camada depois que os efeitos dela rodam. Com o aviso aberto, o Escape fecha só ele. Corrigir exigiria interceptar o Escape fora do Radix; ficou registrado em vez de alterado.
