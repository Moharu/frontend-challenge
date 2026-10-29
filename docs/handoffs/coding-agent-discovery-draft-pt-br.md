# Próxima etapa: base visual e descoberta pública do KURIO

## Objetivo

Substituir a tela provisória pela experiência pública de descoberta: início/catálogo e detalhe do NFT, em desktop e mobile, usando a infraestrutura REST, Query e Socket.IO já implementada.

Entregar interfaces funcionais de busca, filtros, ordenação, paginação, galeria e seleção de edição/quantidade. Não implementar autenticação, favoritos persistidos, carrinho, checkout ou pedidos nesta etapa.

## Ponto de partida e referências

- Repositório: https://github.com/Moharu/frontend-challenge
- Último commit revisado: `ba9a562a52cba9c2cf625f47128388207b73a60c`.
- Requisitos: `docs/challenge-requirements.md`.
- Contratos e decisões existentes: `ARCHITECTURE.md`, `docs/contracts/` e `docs/mock-scenarios.md`.
- Figma autorizado para consulta nesta etapa: https://www.figma.com/design/Zbw0vAAPU80HoDwKVfAcCR/Frontend-Challenge--Copy-?node-id=0-1
- Implantação futura: Vercel. Não implantar nesta tarefa.

Inspecione o checkout atual e as instruções aplicáveis antes de editar. Preserve trabalho mais recente; não resete para o commit citado. Reutilize a stack e o lockfile existentes. Não crie repositório remoto, commit, push ou deploy sem autorização separada.

## Consulta ao design

Consulte o Figma em modo somente leitura. Use o contexto de design e capturas dos frames; não implemente apenas a partir dos nomes das camadas. Siga as instruções da integração Figma disponível.

Frames desta etapa:

- Desktop / Início: `2:2`.
- Mobile / Início: `14:5226`.
- Desktop / Detalhes do NFT: `10:244`.
- Mobile / Detalhes do NFT: `15:5536`.

Consulte também os componentes usados nesses frames, incluindo cabeçalho, filtros, rodapé e navegação mobile. Não altere o arquivo Figma. Não inspecione todas as telas de conta/compra sem necessidade.

Observações já verificadas, a confirmar no arquivo:

- Marca visível KURIO; o nome antigo GreenMint da página não define a marca.
- Tipografia Roboto Mono, fundo marrom quase preto, superfícies marrons, destaque cobre e texto claro.
- Desktop de 1440px com área principal de aproximadamente 1200px.
- Frames mobile de 414px; validar também 390px e tablet de 768px.
- Início desktop: hero, filtros laterais, catálogo de três colunas, paginação, promoções, prévias editoriais e rodapé.
- Início mobile: busca, botão de filtros, hero compacto, grade de duas colunas com composição escalonada e navegação inferior.
- Detalhe desktop: miniaturas, imagem principal, informações, edição, quantidade, abas e itens relacionados.
- Detalhe mobile: destaque para a arte e área inferior de quantidade/preço/ações.

Não copie posições absolutas de toda a página nem fixe a altura da aplicação em 896px. Use layouts responsivos e rolagem natural. Áreas fixas ou sticky devem reservar espaço e respeitar safe areas, teclado virtual e zoom.

## 1. Base visual e assets

- Traduza cores, tipografia, espaçamento, bordas e raios para tokens semânticos reutilizáveis.
- Adapte componentes shadcn/ui à identidade do projeto; instale somente os componentes necessários.
- Baixe e versione os assets reais autorizados pelo Figma. Não use URLs temporárias do Figma em runtime.
- Mantenha fontes e imagens necessárias disponíveis localmente, com licenças/proveniência documentadas quando aplicável.
- Crie um mapeamento explícito entre identificadores de arte dos dados e arquivos locais.
- Preserve proporções, recortes e posições das imagens. Não use screenshots de telas como interface.
- Não substitua artes por imagens geradas ou por serviços remotos aleatórios.
- Use variantes de apresentação desktop/mobile quando necessário, compartilhando dados e lógica de negócio.

## 2. Contratos e fixtures necessários à descoberta

Os modelos atuais foram uma base mínima. Amplie-os somente para os dados públicos usados pelas telas desta etapa, sem implementar contratos privados.

Inventário a representar, quando exibido no design:

- NFT: título, ID do token, coleção (ID/nome), descrição curta e detalhada, categoria, rede, atributos, galeria, arte principal, data de listagem e versão.
- Metadados: referência simulada de contrato, padrão do token, direitos autorais/royalty e informações de procedência.
- Edições: ID estável, rótulo, tipo, preço e disponibilidade/limites. Separe a identidade da edição da quantidade escolhida.
- Descoberta: classificação determinística de novos lançamentos e em alta; marcações de raridade/desconto somente quando sustentadas pelos dados.
- Avaliações: contagem, nota e conteúdo de leitura, caso necessário para a aba presente no design. Não implemente envio de avaliação.
- Itens relacionados da mesma coleção, obtidos por contrato REST documentado; não embuta fixtures nos componentes.

Os filtros do desktop mostram categorias além das três atuais e rede Solana. Complete categorias/redes públicas necessárias ao design e suas fixtures. Ao alterar tipos compartilhados, verifique os contratos dependentes sem implementar carteiras reais. Todas as quantias continuam denominadas em ETH na simulação, conforme o desafio; documente essa convenção.

Amplie o contrato de listagem para os modos Todos, Novos lançamentos e Em alta. Documente se cada modo é filtro ou ordenação, sua regra determinística e sua combinação com os demais parâmetros. Não renderize abas com resultados idênticos por falta de implementação.

Não copie contagens decorativas do Figma. Se houver contagens por categoria/rede, defina e retorne facetas coerentes com os filtros, explicitando a semântica. Mantenha paginação e total corretos.

Ajuste as fixtures e a versão da seed/esquema quando necessário. Preserve os testes de precisão decimal, IDs usados pela suíte ou adapte-os explicitamente. Uma alteração de seed deve restaurar um estado conhecido sem apagar armazenamento não relacionado.

### Inconsistências conhecidas

- O detalhe mobile repete `1/10`, enquanto o desktop inclui `1/1`. Use uma lista canônica de edições vinda da API.
- Campos de contrato e royalty aparentam estar trocados em partes do layout. Mostre os dados sob os rótulos corretos e documente a correção.
- As contagens e preços desenhados são exemplos, não fonte de verdade para cálculos.
- Edição esgotada deve ser identificada e desabilitada. Defina explicitamente como preço mínimo e disponibilidade influenciam o catálogo; preserve ou revise a regra atual de preço de referência com documentação e testes.
- Edição aberta não pode significar quantidade infinita selecionável. Defina um limite de compra simulado e uma representação coerente de oferta, sem inventar estoque a partir de um rótulo.

## 3. Rotas e estado na URL

Implemente `/` para início/catálogo e `/nfts/$nftId` para detalhe, seguindo as convenções do TanStack Router existente.

- Busca, categoria, rede, limites de preço, modo da listagem, ordenação e página pertencem aos search params validados.
- Refresh, links diretos e histórico devem restaurar o estado.
- Alterar busca, filtro, modo ou ordenação reinicia a página.
- Defina normalização/defaults para URLs inválidas; não deixe erros de parser quebrarem a aplicação.
- Use a mesma normalização nas chaves Query e na requisição REST.
- Busca pode usar debounce com cancelamento, preservando navegação pelo histórico de maneira previsível.
- No drawer mobile, mantenha rascunho local até Aplicar; Cancelar não altera a URL.
- Limpar filtros deve ter resultado determinístico.
- Diferencie rota desconhecida de NFT inexistente e ofereça retorno ao catálogo.

Não crie uma segunda fonte global de estado para filtros ou resultados.

## 4. Início e catálogo

Implemente:

- Cabeçalho desktop e navegação mobile conforme os frames.
- Busca acessível: campo mobile e acionamento coerente do ícone desktop, por exemplo um campo expansível ou diálogo.
- Hero e ações Explorar levando ao catálogo/filtro pertinente.
- Filtros combináveis de categoria, rede e preço.
- Controle de ordenação acessível em desktop e mobile.
- Grade de NFTs com links reais para detalhe.
- Paginação funcional em ambos os tamanhos, mesmo quando não aparece no recorte mobile.
- Promoções e itens relacionados com destinos coerentes no catálogo.
- Prévias editoriais e rodapé como composição visual. Não criar páginas editoriais, suporte ou newsletter funcional.

Estado vazio deve explicar o resultado e permitir limpar filtros. Falhas devem exibir recuperação por nova tentativa. Durante atualização em segundo plano, mantenha conteúdo útil e indique atualização sem bloquear toda a tela.

## 5. Detalhe do NFT

- Carregue por ID via Axios/MSW/Query, inclusive em acesso direto e refresh.
- Implemente seleção de miniatura e visualização ampliada acessível, se indicada no design.
- Exiba descrição, metadados, atributos e conteúdo das abas.
- Implemente seleção de edição e quantidade inteira dentro dos limites atuais.
- O preço exibido deve corresponder à edição escolhida. Cálculos e apresentação não devem perder precisão decimal.
- Se a edição se tornar indisponível, informe a alteração e peça nova seleção; não troque silenciosamente por outra edição.
- Se o limite cair abaixo da quantidade selecionada, mostre o conflito e permita corrigir. Não apresente uma seleção inválida como pronta para compra.
- Itens relacionados navegam para seus detalhes.
- Compartilhar deve usar link real da aplicação, com fallback de copiar link e feedback acessível.

## 6. Limite explícito das ações fora desta etapa

Os controles de compra, adicionar ao carrinho, favoritar e entrar podem aparecer para preservar a composição, mas não podem aparentar sucesso.

Adote um padrão consistente: ao acioná-los, exiba um diálogo acessível explicando que a funcionalidade ainda não está disponível nesta versão. Não altere contadores, não preencha corações e não crie pedidos/carrinhos fictícios. Remova o badge numérico ilustrativo do carrinho ou represente honestamente a ausência de itens.

Links editoriais, newsletter e ações auxiliares sem destino real devem informar indisponibilidade, sem falso envio ou navegação quebrada. Não crie OAuth, recuperação de senha ou ações de blockchain.

O ícone central da navegação mobile não tem função definida pelo README: preserve sua aparência e identifique a indisponibilidade, sem inventar um fluxo de scanner ou mint.

Documente essas limitações temporárias para que a próxima etapa substitua os adaptadores de indisponibilidade pelos fluxos reais.

## 7. Integração realtime na aplicação

A aplicação agora pode buscar dados e conectar o catálogo público ao Socket.IO. O teste antigo que proibia tráfego de negócio precisa ser substituído por testes adequados à nova fase.

- Integre o consumidor existente ao ciclo de vida das rotas públicas relevantes.
- Reutilize uma conexão por proprietário definido; não crie uma conexão por card.
- Evite listeners duplicados sob Strict Mode e limpe conexões ao encerrar o ciclo de vida.
- Preserve a correção de caches com versões diferentes do commit revisado.
- Atualizações de preço/disponibilidade devem refletir no catálogo e no detalhe, incluindo filtros/ordenação afetados.
- Exiba aviso acessível no detalhe quando a edição selecionada mudar.
- Após reconexão, reconcilie recursos ativos por REST.
- Mantenha controles de cenário fora dos componentes de produto. Testes devem usar a infraestrutura existente; o build público não deve expor `window.__KURIO_TEST__`.

## 8. Responsividade, acessibilidade e estados

- Verifique 390, 414, 768 e 1440px.
- Preserve a composição dos frames sem esconder filtros, paginação ou informações necessárias no mobile.
- Adicione skeletons com shimmer ao catálogo e detalhe, preservando dimensões e respeitando `prefers-reduced-motion`.
- Garanta labels, nomes acessíveis para ícones, foco visível, navegação por teclado e gestão de foco em diálogos/drawers.
- Use semântica correta para links, botões, abas, campos e paginação.
- Feedback de carregamento, erro e realtime deve ser acessível sem anúncios excessivos.
- Garanta contraste e não dependa apenas de cor.
- Verifique zoom e ausência de overflow horizontal, inclusive nos textos longos e valores ETH.

## 9. Testes e verificação visual

Preserve a suíte de infraestrutura e os testes de regressão de caches. Não apague verificações anteriores apenas para acomodar uma mudança de fixtures.

Adicione E2E observando a interface e passando pelos handlers MSW/cliente Socket.IO reais:

1. Busca, filtros combinados, modos da listagem, ordenação e paginação.
2. Reinício da página ao mudar filtros e restauração por refresh/voltar/avançar.
3. Drawer mobile: aplicar, cancelar e limpar.
4. Navegação catálogo → detalhe, acesso direto e NFT inexistente.
5. Galeria, abas, edição indisponível e limites de quantidade.
6. Resultados vazios, resposta lenta com skeleton e recuperação após falha.
7. Mudança de preço/disponibilidade com detalhe aberto, sem regressão por evento antigo/duplicado.
8. Reconexão e reconciliação de dados ativos.
9. Teclado, foco dos diálogos/drawers e feedback das ações ainda indisponíveis.
10. Ausência da ponte de testes no build normal.

Execute fluxos principais em Chromium desktop e mobile. Gere baselines visuais versionadas de início e detalhe, com fixtures, fontes e relógio estáveis. Espere fontes/imagens carregarem; estabilize animações nos snapshots. Não aprove baselines automaticamente sem inspecionar o resultado.

Compare capturas renderizadas com os frames Figma, corrija diferenças relevantes de tipografia, espaçamento, imagens, proporções e composição. Documente desvios necessários de acessibilidade e conteúdo.

Execute tipos, lint, formatação, build, testes de infraestrutura e E2E pertinentes. Verifique em build otimizado com mocks habilitados. Sem backend real, não use mocks desabilitados como caminho de demonstração nem fabrique respostas alternativas para fazer esse modo funcionar.

Atualize a configuração Lighthouse para início e um detalhe válido. Execute três medições por página/perfil (mobile e desktop), registre medianas, LCP, CLS e TBT e retenha relatórios HTML/JSON. As metas continuam performance ≥90, acessibilidade ≥95, boas práticas ≥95 e SEO ≥90. Registre limitações e causas de resultados abaixo das metas; não remova funcionalidades/assets só para melhorar pontuações.

## 10. Documentação e entrega

Atualize README, arquitetura, contratos públicos e cenários em pt-BR. Inclua:

- Rotas, parâmetros e semântica dos filtros/modos.
- Campos públicos adicionados, versões de fixtures e mapeamento de assets.
- Política de ciclo de vida do socket e feedback de mudanças.
- Decisões para inconsistências do Figma e limites de edição aberta.
- Funcionalidades implementadas e controles temporariamente indisponíveis.
- Comandos para reproduzir E2E, snapshots e auditorias.
- Evidências executadas, limitações e resultados não verificados.

Ao concluir, informe arquivos alterados, fluxos entregues, resultados dos testes e auditorias e eventuais desvios visuais. Não declare o desafio inteiro concluído.

**Pare após a descoberta pública. Não avance para autenticação, favoritos persistidos, carrinho, checkout, pedidos, commit, push ou deploy sem nova autorização.**
