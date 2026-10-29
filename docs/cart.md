# Carrinho persistente do visitante

Primeira etapa do fluxo de compra: catálogo → NFT → **carrinho**. O carrinho funciona de ponta a ponta com Axios, TanStack Query, MSW e Socket.IO. Autenticação, mesclagem no login, favoritos persistidos, checkout, cotação, pedidos, perfil e carteiras continuam fora desta etapa.

## Identidade do visitante

O carrinho pertence ao servidor simulado. O cliente guarda somente um **token opaco de visitante** em `localStorage` (`kurio.visitor.v1`, com fallback em memória) e o envia no cabeçalho `X-Visitor-Token` em todas as requisições do carrinho, pelo Axios. O conteúdo do carrinho nunca é lido do armazenamento do cliente.

- `POST /visitor-sessions` emite o token. O cliente só o cria na primeira mutation (uma única requisição compartilhada em voo); visitantes que nunca adicionam itens não criam carrinho no servidor. Sem token, a leitura resolve para "sem carrinho" sem requisição.
- Token desconhecido (por exemplo, após `reset()` dos mocks) responde 401 `SESSION_INVALID`. A leitura descarta o token e mostra carrinho vazio; a mutation descarta o token, emite outro e repete uma única vez.
- **Mesclagem futura:** o servidor mapeia token → carrinho. No login, a próxima etapa deve enviar o token junto da sessão para que o servidor mescle as linhas no carrinho do usuário (somando quantidades da mesma edição até o limite efetivo, sem reduzir silenciosamente) e invalide o token. Nada disso foi implementado.
- Um novo contexto do navegador não tem token e começa com carrinho vazio.

## Regras do carrinho

- **Linhas:** identificadas por NFT + edição; adicionar a mesma edição soma à linha existente. Cada linha expõe nome, arte, ID do token, rótulo canônico da edição, preço unitário atual, total da linha, disponibilidade, limite de compra, `maxQuantity = min(available, purchaseLimit)` e a versão do NFT considerada.
- **Preço atual:** a linha sempre usa o preço atual da edição. O servidor guarda o último preço reconhecido; enquanto for diferente do atual, a linha expõe `priceChange` (anterior e atual). Alterar a quantidade ou enviar `acknowledgePriceEth` com o preço atual reconhece a mudança; um preço reconhecido que já mudou de novo responde 409.
- **Indisponibilidade:** a API nunca reduz nem remove linhas sozinha. Edição esgotada gera `SOLD_OUT`; quantidade acima do limite gera `QUANTITY_ABOVE_LIMIT` com o máximo atual. `hasConflicts` bloqueia "Conectar e finalizar" até a correção (ajustar ou remover).
- **Sem reserva de estoque:** adicionar ao carrinho não reserva disponibilidade. Preço, disponibilidade e limites continuam pertencendo ao catálogo; o checkout deverá revalidar tudo na cotação.
- **Quantidade:** inteiro de 1 a 1000 na API; a interface limita de 1 ao máximo efetivo. Diminuir abaixo de 1 não remove; remover é uma ação separada.
- **Adicionar além do limite:** 409 `CONFLICT` com mensagem explicando quanto ainda é possível adicionar (`fields.quantity` traz o número); o carrinho não muda.
- **Versão:** toda alteração incrementa `version` e `updatedAt` (relógio lógico). Operações são absolutas (definir quantidade, remover, aplicar cupom), então não exigem versão do cliente; o reconhecimento de preço é a única operação condicionada ao estado anterior e usa o próprio preço como verificação.

### Resumo, rede e taxa

`summary` traz subtotal, desconto, taxa de rede e total já calculados pela API; a interface só exibe. O subtotal soma todas as linhas, inclusive as em conflito (a finalização fica bloqueada até a correção). O carrinho ainda não tem carteira escolhida, então exibe a taxa **estimada** para Ethereum (`feeNetwork: "ethereum"`, `feeEstimated: true`), com a legenda "Taxa estimada (Ethereum)". Taxa fixa por pedido, não por item: Ethereum 0.016, Polygon 0.002, Solana 0.0005 ETH. Carrinho vazio não tem taxa. Todas as quantias são ETH, inclusive para NFTs de Polygon/Solana (convenção da simulação).

### Cupons de demonstração

| Código       | Efeito                                | Validade                                      |
| ------------ | ------------------------------------- | --------------------------------------------- |
| `KURIO10`    | 10% do subtotal                       | válido (expira em 2027-01-01, relógio lógico) |
| `LANCAMENTO` | 0.1 ETH fixo, nunca acima do subtotal | válido                                        |
| `KURIO15`    | 15% do subtotal                       | **expirado** (2025-12-31)                     |

`PUT /cart/coupon` aplica (código sem diferenciar maiúsculas, espaços removidos) e substitui o anterior; `DELETE /cart/coupon` remove. Um cupom por carrinho, persistido com ele. Erros: 400 `VALIDATION` com `fields.coupon` "Este código promocional não existe." ou "Este código promocional expirou." A validade usa o relógio lógico da simulação (`baseline + tick` segundos), nunca o relógio real. O desconto incide somente sobre o subtotal, nunca sobre a taxa.

## Aritmética e formatação de ETH

`src/contracts/eth.ts` é usado pelos handlers MSW (fonte dos valores) e pela interface (exibição). Tudo roda em unidades inteiras `bigint` de 10^-18 ETH; nenhum cálculo passa por `Number`, `parseFloat` ou `toFixed`.

- `addEth`, `subtractEth` (com piso zero), `multiplyEth` (quantidade inteira não negativa), `minEth`, `fromEthUnits`.
- `percentOfEth(valor, pontosBase)`: percentual em pontos-base inteiros (1000 = 10%), **arredondado para baixo** na menor unidade: o comprador nunca recebe desconto maior que o anunciado.
- `formatEth` (somente exibição): ponto como separador decimal, mínimo de duas casas, todas as casas significativas preservadas, sem notação exponencial (`26` → `26.00`, `0.016` → `0.016`, `3.000000000000000003` mantém as 18 casas). Valores longos quebram linha (`overflow-wrap: anywhere`) sem overflow horizontal.
- Desconto zero aparece como `0.00 ETH`; desconto positivo sempre com o prefixo `(-)`.

## Rotas e interface

- `/cart` é rota lazy do TanStack Router; acesso direto e refresh funcionam no build otimizado.
- **Detalhe:** "Adicionar ao carrinho" envia edição e quantidade e anuncia o resultado numa região `status` com link "Ver carrinho", sem diálogo. "Comprar NFT" adiciona e navega para `/cart`. Seleções em conflito continuam desabilitadas; 409 mostra a explicação da API.
- **Badge:** soma das quantidades; oculto quando vazio; `99+` acima de 99. O nome acessível do link informa a quantidade exata ("Carrinho, 120 itens" / "Carrinho, vazio"). Aparece no cabeçalho desktop e na navegação mobile.
- **Tela:** uma única `<table>` semântica (cabeçalhos NFTs, Preço, Edições, Total) que vira cards no mobile por CSS, sem duplicar controles. Controles de quantidade e remoção têm nomes com NFT, edição e quantidade atual. Durante a mutation, os botões da linha usam `aria-disabled` (o foco permanece) e envios concorrentes da mesma linha são ignorados.
- **Foco:** após alterar quantidade, o foco permanece no botão, inclusive quando ele atinge o limite (indisponibilidade por `aria-disabled`, sem perder o foco); após remover, vai para o nome da próxima linha (ou anterior) e, sem itens, para o título do estado vazio.
- **Cupom:** formulário com rótulo, erro associado ao campo (`aria-invalid`/`aria-describedby`), cupom aplicado com ação "Remover cupom".
- **Anúncios:** uma região `status` anuncia mudanças de preço/disponibilidade por linha e o novo total, sem repetir a tela; a primeira carga não é anunciada.
- **Estados:** skeleton com shimmer preservando dimensões das linhas e do resumo (respeita `prefers-reduced-motion`); falha de carga com "Tentar novamente"; falha de mutation preserva o estado anterior e mostra o erro na linha/campo; falha em atualização de fundo mantém o carrinho visível com aviso e nova tentativa; estado vazio (não desenhado no Figma) com chamada para o catálogo.
- **Navegação:** "Continuar explorando" leva ao catálogo; o botão voltar do mobile volta pelo histórico interno quando existe e, senão, vai ao catálogo.
- **"Colecionadores também viram":** reutiliza `GET /nfts?mode=trending&pageSize=15`, exclui NFTs presentes no carrinho e oculta a seção se nada restar. Carrossel com rolagem por snap e pontos como botões ("Recomendações, página N de M").

## Tempo real

O consumidor único de `PublicLayout` continua sendo a única conexão. Um `nft.updated` cujo NFT está em alguma linha invalida o carrinho, que é buscado de novo por REST; a interface nunca recalcula valores. A deduplicação existente impede que eventos duplicados/antigos reapliquem efeitos, e a resposta REST sempre reflete o estado atual. A reconexão reconcilia o carrinho ativo junto com as demais consultas.

## Múltiplas abas

O estado simulado continua num único retrato em `localStorage`. Antes de cada leitura e de cada transação de escrita, o store adota o retrato persistido se o contador lógico `tick` dele for maior que o da memória; assim uma aba não sobrescreve os carrinhos gravados por outra com dados antigos. Comportamento verificado manualmente pelo usuário: com duas abas visíveis ao mesmo tempo, a mudança de uma não aparece na outra; ao voltar para uma aba, ela se atualiza, porque o TanStack Query busca de novo as consultas desatualizadas quando a janela recupera o foco (o carrinho usa `staleTime: 0`) e o store adota o retrato mais recente antes da leitura. Esse comportamento foi aceito pelo usuário. Limites: não há notificação ativa entre abas e duas gravações simultâneas com o mesmo `tick` ainda resolvem por "última gravação vence". Coordenação completa entre abas continua fora do escopo.

## Design e desvios do Figma

Frames consultados por capturas e exportações fornecidas pelo usuário (sem acesso ao Figma nesta etapa, por limite da integração): Desktop / Carrinho `11:1278` e Mobile / Carrinho `16:360`. Ícones exportados: lixeira, botões −/+ e pontos do carrossel (`public/assets/figma/cart-*.svg`); seta voltar reutiliza `mobile-detail-ArrowLeft2.svg`. Badge reproduz `home-Badge.svg` em CSS para exibir a contagem.

- Valores do layout (26.83, 8.92, badge 6, `(-) 00.00`) não são copiados; tudo vem da API.
- Desktop: a linha mostra também "Edição: 1/20", porque edições diferentes do mesmo NFT são linhas separadas. A linha fica um pouco mais alta que no frame.
- Mobile: a lixeira fica no canto superior direito de cada card e a quantidade no inferior direito, sem a sobreposição desenhada no card "Ivory Baron". O botão `−` fica desabilitado na quantidade 1, como no frame.
- Rótulos de edição são os canônicos da API (`1/20`, `1/1`, `Aberta`), não os exemplos `1/50`/`1/10`.
- "Resumo da carteira" foi mantido como título do resumo (não conflita com carteiras nesta etapa). "Desconto do lançamento" virou "Desconto", com o código aplicado entre parênteses, porque o desconto vem de qualquer cupom.
- "Taxa estimada" ganhou "(Ethereum)" para deixar a rede da estimativa explícita.
- Mobile: o resumo fixo inferior reserva sua altura medida no fim da página (o último card e o rodapé nunca ficam escondidos), respeita safe area e limita-se a 70% da altura visível com rolagem interna, para zoom e teclado virtual. O título "Resumo da carteira", o rótulo do cupom e "Continuar explorando" ficam somente para leitores de tela no mobile, como no frame; o voltar cobre a navegação.
- Navegação inferior oculta no carrinho mobile, como no frame.
- Campo de cupom mobile: texto digitado em 16px (evita zoom automático do iOS ao focar) e placeholder em 12px, para o texto "Digite o código promocional..." caber inteiro em 390px.
- **768px:** usa a tabela desktop com o resumo abaixo, alinhado à direita (até 480px). Uma coluna lateral de 332px deixaria a tabela estreita demais para preço, quantidade e total legíveis.
- Detalhe: uma linha reservada abaixo dos botões recebe o feedback de "Adicionar ao carrinho", evitando deslocamento de layout quando a mensagem aparece.

## Ações ainda indisponíveis

"Conectar e finalizar" abre o diálogo de indisponibilidade dizendo que o checkout ainda não está disponível e que o carrinho continua salvo. Favoritar, Entrar, conta, navegação editorial, newsletter, redes sociais e o ícone central mobile continuam com o adaptador `Unavailable`. Carrinho e "Comprar NFT" deixaram de usar o adaptador. Não há pedido, cotação, login ou carteira fictícios.

## Reprodução

```sh
npm run build && npm run test:e2e
npm run build:integration && npm run test:integration
npm run audit:lighthouse && node scripts/lighthouse-medians.mjs
```

Evidências, Lighthouse e o que não foi verificado: [verificação do carrinho](cart-verification.md).
