# Descoberta pública do KURIO

## Rotas e estado da descoberta

`/` reúne início e catálogo; `/nfts/$nftId` carrega um NFT por ID, inclusive por acesso direto. Uma rota desconhecida e um NFT inexistente têm mensagens distintas e retorno ao catálogo. A interface usa apenas os contratos REST de descoberta e eventos públicos; recursos privados continuam sem implementação.

Busca, categoria, rede, preço mínimo/máximo, modo, ordenação, página e tamanho da página ficam nos parâmetros da URL. TanStack Router valida esses parâmetros com a normalização compartilhada do contrato. Parâmetros inválidos usam o padrão do campo, sem quebrar a página; parâmetros desconhecidos não são utilizados pela interface. A API mantém validação estrita e retorna 400 para consultas inválidas. Valores padrão podem estar implícitos em uma URL digitada; navegações da interface escrevem os parâmetros normalizados.

A busca é enviada explicitamente pelo formulário, sem debounce. A consulta normaliza espaços nas extremidades e letras minúsculas. Mudar busca/filtro/modo/ordenação reinicia a página em 1; voltar, avançar e recarregar restauram o estado. O formulário mobile mantém rascunho até Aplicar. Cancelar não altera a URL e Limpar filtros restaura o rascunho; Aplicar confirma a limpeza. O estado vazio oferece limpeza imediata. Não há um segundo estado global de filtros/resultados.

| Parâmetro       | Regra                                                                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mode=all`      | Todos os NFTs compatíveis com os demais filtros                                                                                                       |
| `mode=new`      | Filtra `discovery.isNew`; os oito primeiros NFTs da seed 2 são novos                                                                                  |
| `mode=trending` | Filtra pontuação determinística `trendingScore >= 100`; no sort padrão `newest`, ordena primeiro por pontuação decrescente, exibida como Popularidade |
| `sort`          | `newest`, `price-asc`, `price-desc`, `name-asc`; uma ordenação explícita por preço/nome prevalece sobre a pontuação de Em alta                        |
| `pageSize`      | API mantém padrão 8; a interface usa 9 para a grade desktop de três colunas; ambos permitem paginação mobile                                          |

Todos os modos combinam busca, categoria, rede e faixa de preço com AND. Empates usam ID crescente. O catálogo mantém o preço de referência mínimo entre **todas** as edições, inclusive esgotadas. Esse preço não é promessa de compra. No detalhe, preço e total pertencem à edição selecionada; contas usam unidades inteiras bigint de ETH, sem ponto flutuante. Facetas da API contam o conjunto já filtrado antes da paginação, incluindo os filtros da própria dimensão; a interface não mostra contagens decorativas do Figma.

## Dados públicos e edições

NFTs incluem tokenId, coleção, descrição curta/detalhada, atributos, galeria, metadados simulados de contrato/padrão/royalty/procedência, classificação de descoberta e avaliações de leitura. A fonte é o estado servido pelo MSW, não dados fictícios embutidos nos componentes. `GET /nfts/:id/related` retorna até cinco NFTs da mesma coleção, excluindo o atual, na ordem estável da seed.

A seed mantém `nft-001`..`nft-024` e os IDs de edições anteriores. Agora possui nove categorias e redes Ethereum, Polygon e Solana. As primeiras 18 peças alternam arte/música/fotografia e Ethereum/Polygon; as seis últimas cobrem as demais categorias e Solana. **Todas as quantias continuam em ETH**, inclusive Polygon/Solana, como convenção da simulação exigida pelo desafio; não há conversão, carteira ou blockchain real.

`schemaVersion` e `seedVersion` passam a **2**, mantendo a chave histórica `kurio.mock.catalog.v1`. Snapshots da versão anterior são incompatíveis e restauram somente esse estado conhecido; nenhuma outra chave da origem é apagada. Os dois primeiros preços padrão são 1.19 e 1.69 ETH. Os testes de precisão mantêm os mesmos IDs e injetam explicitamente valores com 18 casas decimais antes das verificações; nenhuma verificação de precisão foi removida.

Cada edição tem label e purchaseLimit. Limitada: emissão 20, disponibilidade inicial 10, limite de compra 5. Única: emissão/disponibilidade 1 e limite 1. Aberta: emissão simulada finita de 100, disponibilidade inicial 30 e limite 3 por compra; no primeiro NFT começa esgotada. “Aberta” não representa quantidade infinita. A quantidade selecionável usa o menor valor entre disponibilidade e limite de compra.

Uma edição esgotada fica identificada e desabilitada. Mudanças de versão do NFT produzem aviso acessível no detalhe. A seleção não troca de edição silenciosamente; indisponibilidade exige nova escolha, e queda de limite mantém o conflito visível até correção explícita. Comprar fica desabilitado em seleção inválida. Mesmo com seleção válida, comprar/adicionar ao carrinho não executam negócio nesta etapa.

## Design, recursos e desvios

Referência autorizada: arquivo Figma `Zbw0vAAPU80HoDwKVfAcCR`, frames `2:2`, `14:5226`, `10:244` e `15:5536`. Consulta somente leitura com contexto e capturas; nenhum arquivo Figma foi alterado. Marca KURIO, Roboto Mono, fundo `#140d0a`, superfícies `#241612`/`#2f1d15`, cobre `#d28a4c`, destaque `#e89b55` e texto claro. Tokens estão em `src/styles/globals.css`.

Os 90 arquivos fornecidos pelo contexto estão versionáveis em `public/assets/figma/`; o inventário `docs/figma-assets.json` relaciona nomes aos quatro frames. Não existem URLs temporárias do Figma em runtime. Nenhuma imagem gerada ou serviço remoto aleatório foi usado. O mapeamento de identificadores de arte para arquivos é explícito em `src/components/discovery/assets.ts`: emerald, sage, ivory e golden apontam para os PNG originais do Figma, e a interface serve derivados WebP responsivos (240/480/800/1254px) em `public/assets/art/`, gerados por `scripts/optimize-artwork.mjs`. A galeria canônica repete as vistas fornecidas no frame, que utiliza a mesma arte nas miniaturas. Arte fornecida pelo arquivo foi usada sob autorização para o desafio; o inventário não atribui uma licença independente às imagens.

Roboto Mono é servida localmente por `@fontsource/roboto-mono`, pesos 400/500/700, subconjunto latin. A licença original OFL está em `public/assets/fonts/RobotoMono-OFL.txt`. Primitivos Radix Dialog/Tabs dão foco, Escape, teclado e semântica aos componentes locais adaptados ao padrão shadcn. Button usa cva e cn existentes. Não foi instalada outra biblioteca visual.

Diferenças intencionais em relação aos desenhos:

- Edições vêm de uma lista única da API; não se reproduz a repetição contraditória de `1/10`. O conjunto atual usa `1/20`, `1/1` e Aberta.
- Contrato, padrão do token e royalty aparecem sob rótulos corretos, corrigindo a troca aparente no layout.
- Preços, IDs, notas, avaliações, raridade e totais vêm dos dados. Não há desconto fictício ou contagem copiada do desenho.
- Barra lateral (Figma): coleções e redes com a contagem de NFTs vinda das facetas da API, aplicadas ao clicar. Faixa de preço com controle deslizante de dois marcadores (passos de 0,01 ETH, limites vindos da faceta `price`; um marcador na ponta significa sem limite). O botão Aplicar vale só para o preço, e "Limpar filtros" aplica na hora. O drawer mobile guarda tudo como rascunho até Aplicar.
- Cartões no desktop com mouse: carrinho (abre o detalhe), coração e lupa (imagem ampliada) aparecem sob a arte no hover ou no foco do teclado. Sem hover (toque, mobile), só o coração, no canto.
- Detalhe (Figma): estrelas com a nota média e "N avaliações de colecionadores"; quantidade à esquerda, Comprar e Favoritar à direita; metadados em linha; compartilhamento por LinkedIn, e-mail e Twitter, mais "Copiar link".
- Paginação e ordenação continuam acessíveis no mobile, além do recorte estático do frame. O drawer oferece Aplicar/Cancelar/Limpar. Busca, filtros (barra lateral e drawer), modo e ordenação sempre voltam à página 1; só os botões de paginação mudam a página.
- Campos de preço digitáveis substituem o controle decorativo para permitir limites exatos e uso por teclado.
- Cabeçalho desktop abre a busca por hash; no mobile o formulário permanece visível. Controles recebem nomes acessíveis e foco visível.
- A navegação inferior pertence ao início; no detalhe mobile, a área inferior é dedicada à quantidade/preço/ações. Há espaço reservado no fim da página e consideração de safe areas, sem altura fixa de aplicativo. A barra reproduz o recorte do Figma (`mobile-home-Vector.svg`) por máscara CSS: a curva central mantém a largura exata de 152px e as laterais se estendem, evitando distorção entre 390 e 700px; o botão central usa o gradiente de `mobile-home-Ellipse39.svg` e fica centralizado na borda superior, deixando o conteúdo visível pelo recorte como no desenho.
- Blocos editoriais e rodapé continuam abaixo do catálogo no mobile, em fluxo natural. Textos e controles reais podem aumentar a altura em relação ao recorte do Figma. Não se usa captura da tela como interface.

## Cabeçalho, navegação e rodapé (ajustes após revisão)

- O cabeçalho desktop é fixo no topo (`position: sticky`) em todas as rotas públicas; saltos para âncoras e o foco por teclado no conteúdo reservam espaço para ele por `scroll-margin-top` nos alvos (links, botões, campos e elementos com `id`). Não se usa `scroll-padding-top` na página: com ele, focar qualquer elemento dentro do cabeçalho fixo (ou da barra fixa de busca mobile) rolava a página de volta ao topo.
- Início e Mercado apontam para `/`, então o roteador marcaria os dois como ativos. O estado ativo (classe e `aria-current="page"`) vem da posição: Mercado enquanto o catálogo cruza o meio da tela, Início no restante da página inicial; no detalhe e no carrinho, Mercado.
- Início, Mercado, o ícone de busca e o Início da navegação mobile **preservam filtros e ordenação** (reaproveitam e normalizam os parâmetros atuais). Na página inicial também rolam para o topo/catálogo; em outras rotas levam ao catálogo padrão. O logotipo KURIO continua levando ao catálogo sem filtros.
- A busca desktop fica no cabeçalho: o ícone expande um campo inline. Escape fecha mantendo a busca; × ("Limpar busca") remove o termo da URL, mantendo os demais filtros, e fecha; ambos devolvem o foco ao ícone. Enviar mantém filtros/ordenação, aplica o termo e volta à página 1 do catálogo, em qualquer rota. A barra de busca da página inicial passou a existir só no mobile.
- No mobile, a barra de busca e o botão de filtros ficam fixos no topo durante a navegação do catálogo, com fundo cobrindo as laterais; saltos para âncoras reservam espaço para ela. O drawer de filtros ocupa a tela inteira.
- Estilos de hover só se aplicam a dispositivos com ponteiro real (`@media (hover: hover)`); em toque, eles ficavam presos após o toque (ex.: "Explorar" do hero mobile ganhava fundo laranja).
- Campos de texto e selects desenham o anel de foco dentro da própria borda, acompanhando o raio, sem sobrepor botões acoplados (ex.: cupom).
- "Carteiras compatíveis" usa o selo do Figma com preenchimento uniforme nos dois lados (o Figma tem padding menor à direita). No mobile, redes sociais e o selo ocupam a largura toda do rodapé para o selo caber numa linha.

## Tempo real e ações temporariamente indisponíveis

`PublicLayout` é o proprietário de uma conexão pública para as rotas, nunca uma por cartão. Carrega o módulo Socket.IO dinamicamente depois de MSW estar pronto: o cliente captura a implementação WebSocket na importação, então carregá-lo antes da interceptação impede o protocolo. A limpeza lida com desmontagem e Strict Mode. Detalhe é carregado em um módulo separado; o cliente e MSW também têm arquivos separados no build.

O consumidor preserva a correção de caches de versões diferentes. Eventos novos atualizam detalhe e invalidam listas/relacionados; reconexão invalida os recursos ativos e busca REST novamente. Eventos duplicados/antigos já recebidos não reaplicam efeitos. Falhas iniciais têm recuperação; atualizações em segundo plano mantêm os dados úteis e sinalizam erro sem escondê-los. Skeletons usam shimmer com dimensões reservadas e desativam animação por prefers-reduced-motion.

Atualização da etapa do carrinho: comprar e adicionar ao carrinho agora são ações reais, e o badge do carrinho mostra a quantidade real (ver [carrinho](cart.md)). Na etapa de descoberta, comprar, adicionar ao carrinho, favoritar, entrar, ações de conta/editoriais/newsletter/redes sociais e o ícone central mobile exibem o mesmo diálogo acessível de indisponibilidade. Não alteram favoritos, contadores ou estado privado e não simulam envio bem-sucedido. O badge ilustrativo de carrinho foi removido. Compartilhar usa a URL real com fallback de cópia e mensagem acessível; não cria transação ou link blockchain.

## Reprodução e referências visuais

```sh
npm ci
npx playwright install chromium
npm run dev:mocks
npm run build
npm run test:e2e
npm run build:integration
npm run test:integration
npm run audit:lighthouse
```

Mocks passam a ser habilitados por padrão e em `.env.example`, pois não há backend real. `VITE_ENABLE_MOCKS=false` ainda é interpretado corretamente, mas não é um modo funcional de demonstração sem uma API externa compatível. Não existem respostas alternativas no cliente para esse modo. Todos os VITE_* continuam públicos e definidos no build.

A integração usa `dist-integration/` com ponte explícita de testes. A entrada `/__protocol` desse build inicializa a infraestrutura sem montar o produto, isolando os 14 testes de protocolo das consultas/conexão reais da interface. O build normal não inclui essa ponte nem uma página de depuração. Os testes de interface usam a aplicação real com o mesmo HTTP/Query/Socket.IO, em projetos desktop e mobile. Artefatos são separados em `test-results/{e2e,integration}` e `playwright-report/{e2e,integration}`.

As quatro referências de início/detalhe em desktop/mobile ficam em `tests/e2e/discovery.spec.ts-snapshots/`. Capturas aguardam fontes e imagens, fixam o relógio e desativam animações na comparação. Para propor novas referências, execute `npm run test:e2e -- --update-snapshots`, inspecione os arquivos e compare com o Figma antes de aceitá-los; não atualize referências apenas para esconder diferenças.

Lighthouse mede `/` e `/nfts/nft-001` no build otimizado com mocks, três execuções por rota e perfil. Relatórios completos HTML/JSON ficam em `reports/lighthouse/{mobile,desktop}`. O relatório desta etapa registra medianas por categoria, LCP, CLS e TBT, ambiente e limitações em `docs/discovery-verification.md`. Metas: desempenho 90, acessibilidade 95, boas práticas 95 e SEO 90. Resultados de infraestrutura anteriores não representam essas telas.
