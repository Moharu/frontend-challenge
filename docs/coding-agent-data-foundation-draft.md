# Orientações para o agente de programação: contratos e base de dados simulada

## Objetivo

Estender a inicialização existente do KURIO com contratos de transporte tipados, backend simulado determinístico e persistido e integração REST + Socket.IO verificada. Manter a aplicação visível na tela provisória existente.

Esta é a base para futuras funcionalidades do marketplace. Implementar infraestrutura e testes executáveis de protocolo, não telas de produto ou fluxos de negócio completos.

## Ponto de partida

- Repositório: https://github.com/Moharu/frontend-challenge
- Último commit revisado: `c6940d4745812c2152dffa6d3972012ffeff0402`.
- Requisitos: `docs/challenge-requirements.md` no repositório.
- Orientações existentes: `README.md`, `ARCHITECTURE.md` e `docs/bootstrap-scope.md`.
- Hospedagem futura: Vercel. A implantação não faz parte desta tarefa.

Inspecionar a cópia atual do repositório e as instruções aplicáveis antes de editar. Preservar trabalhos mais recentes e convenções existentes. Não restaurar o projeto para o commit revisado nem substituir a inicialização.

Manter React, TypeScript, TanStack Router, TanStack Query, Axios, Tailwind, configuração shadcn, MSW, Socket.IO, Playwright e o gerenciador de pacotes atual. Preservar a validação de inicialização com tratamento de erros e a verificação de tipos E2E adicionadas no commit revisado.

Não abrir Figma nem baixar recursos de design. Não criar repositório remoto, fazer commit, push ou implantar, salvo autorização separada do usuário.

## Escopo

Implementar:

1. Contratos tipados compartilhados de REST e eventos.
2. Estado de mocks versionado e determinístico, com mecanismo de restauração.
3. Handlers REST de listagem/detalhe de NFT com comportamento de consulta.
4. Conexão real de cliente Socket.IO interceptada pelo MSW, incluindo um evento de atualização do catálogo.
5. Cenários controlados de latência/erro/eventos para os recursos implementados.
6. Definições de consultas e infraestrutura de reconciliação de tempo real, exercitadas por uma estrutura exclusiva de testes.
7. Testes focados e documentação.

Não implementar:

- Telas de catálogo, detalhe, carrinho, checkout, conta, carteira, favoritos ou pedidos.
- Comportamento de login/sessão, mesclagem de carrinho, cotações, criação de pedidos, transições de pagamento ou alterações de conta.
- Backend simulado completo para todos os contratos definidos abaixo.
- Blockchain real, extensões de carteira, provedores de pagamento, bancos de dados externos ou servidor separado de socket.
- Controles de cenários ou painéis de depuração voltados à produção.
- Tema de produto, novos recursos visuais, referências visuais de regressão ou novos alvos Lighthouse.

A aplicação deve continuar exibindo a tela provisória existente, sem buscar NFTs automaticamente ou abrir uma conexão de socket. Os testes de integração podem invocar explicitamente a infraestrutura por uma estrutura de testes isolada.

## 1. Contratos

Definir contratos de transporte independentes de React, Query, Axios e MSW. Organizá-los por recurso em vez de criar um único arquivo enorme.

Documentar caminhos de endpoints propostos, métodos, parâmetros de consulta, corpos de requisição, envelopes de resposta e erros para os recursos mínimos do desafio:

- Conta/sessão: cadastro, login, consulta de sessão, logout e comportamento de expiração.
- NFTs: listagem paginada e detalhe.
- Favoritos: listar, adicionar, remover.
- Carrinho: obter, adicionar item, alterar quantidade, remover item.
- Cotações: validar conteúdo do carrinho, cupom, preços, disponibilidade, descontos, taxas e totais.
- Pedidos: criação idempotente, consulta de estado e recibo imutável.
- Perfil: leitura/atualização de dados, avatar e senha.
- Carteiras: listar, criar e atualizar carteiras principal/secundária.

Implementar agora somente os endpoints de listagem/detalhe de NFT. Marcar todos os demais explicitamente como **somente contrato / não implementado** na documentação. Não retornar respostas de sucesso fabricadas para eles.

Restrições dos contratos:

- Valores em ETH trafegam como strings decimais; não convertê-los para números JavaScript de ponto flutuante ao filtrar ou ordenar por preço.
- Quantidades e limites de emissão são inteiros. Diferenciar identidade do NFT, identidade da edição e disponibilidade da edição.
- Consultas de lista suportam busca, filtros combinados de categoria/rede/preço, ordenação e paginação.
- Definir ordenação estável com desempate por ID e documentar o comportamento para consultas inválidas.
- Definir um envelope de erro com código estável, mensagem segura, erros de campo opcionais e estrutura suficiente para distinguir falhas de validação, sessão, permissão, recurso não encontrado, conflito e falhas transitórias.
- Contratos de pedido incluem chave de idempotência, identidade/versão da cotação, itens e valores comprados imutáveis e estados pendente/confirmado/recusado.
- Definir semântica de conflito para reutilização de chave de idempotência com corpo diferente; a implementação fica adiada.
- Envelopes de evento incluem ID do evento, ID do recurso, versão monotônica do recurso, data/hora e conteúdo tipado.
- Definir `nft.updated` e `order.updated`; emitir e consumir somente `nft.updated` nesta etapa.
- Contratos de eventos privados devem permitir isolamento futuro por sessão/usuário. Não adicionar tratamento fictício de sessão aos eventos públicos de catálogo.

Reutilizar tipos entre handlers, funções de API, definições de consultas, massas de dados e testes. Adicionar validação em tempo de execução nas fronteiras externas quando útil. Preferir analisadores pequenos e explícitos; introduzir uma dependência de esquemas somente se reduzir significativamente a duplicação, explicando a decisão.

## 2. Estado determinístico dos mocks

Criar um pequeno estado tipado com uma única fonte de referência em memória e retratos persistidos em IndexedDB ou outro armazenamento local adequado no navegador. Escolher a abordagem mais simples que permita inicialização, recarregamento e restauração confiáveis. Usar um pequeno auxiliar bem mantido somente se necessário.

Requisitos:

- Incluir versão do esquema e versão da massa inicial/cenário.
- Inicializar a partir do estado persistido antes que handlers de requisições e sockets atendam dados.
- Restaurar uma massa inicial conhecida quando o armazenamento estiver ausente, incompatível ou corrompido; documentar a política.
- Usar um espaço de nomes claro no armazenamento. A restauração não deve limpar dados de outras partes da origem.
- A restauração recompõe todo o estado implementado, limpa falhas injetadas e eventos agendados e estabelece uma base conhecida de cenário/relógio.
- Serializar atualizações ou impedir de outra forma que gravações sobrepostas persistam um retrato antigo sobre um mais recente.
- Persistir uma atualização de NFT antes de emitir o evento correspondente. Uma requisição REST posterior deve observar a versão e os valores atualizados.
- Documentar suporte ou limitações de múltiplas abas; não prometer consistência entre abas sem implementá-la.

Criar NFTs suficientes para pelo menos três páginas no tamanho padrão, múltiplas categorias e redes, diferentes faixas de preço e múltiplos tipos de edição. Usar IDs estáveis e datas/horários determinísticos. Sem serviços externos de imagens aleatórias ou dependências de rede. As referências de arte podem permanecer como identificadores ou recursos locais provisórios documentados, pois nenhum cartão de produto será renderizado ainda.

Representar pelo menos duas identidades fictícias de usuário como massa inicial futura, sem implementar autenticação nem armazenar senhas em texto puro. Não criar estados de carrinho/pedido/perfil não utilizados apenas para preencher a estrutura de diretórios.

## 3. Implementação REST de NFTs

Implementar handlers MSW na camada de rede para listagem de NFTs e consulta por ID, usando o estado e os contratos compartilhados.

- Requisições devem passar pelo cliente Axios existente.
- Adicionar funções de API tipadas e fábricas de opções/chaves TanStack Query.
- Incluir todos os parâmetros normalizados nas chaves de consulta.
- Encaminhar sinais de cancelamento do Query pelo Axios.
- Retornar resultados reais de filtragem, ordenação e paginação da massa de dados.
- Validar valores da consulta e retornar a estrutura de erro documentada.
- Retornar resposta adequada de não encontrado para NFTs desconhecidos.
- Implementar latência determinística configurável, cenário de resultado vazio, falha HTTP e falha de rede.
- Permitir duas consultas com atrasos diferentes para exercitar respostas fora de ordem.
- Não colocar massas de dados ou caminhos alternativos de negócio em componentes, funções de API ou hooks Query.

Usar uma URL base de API explícita na correspondência dos handlers. Tornar mais rigoroso o tratamento de requisições não atendidas para a API configurada, permitindo recursos estáticos e o transporte de socket documentado. Endpoints de API não suportados devem falhar visivelmente no desenvolvimento/testes, em vez de receberem uma página HTML com status de sucesso.

## 4. Demonstração do protocolo Socket.IO

Ler a documentação e as exportações da integração instalada antes de implementar. Verificar o comportamento real do pacote em vez de presumir uma API de outra versão.

- Usar `socket.io-client` e a integração do MSW compatível com Socket.IO.
- Usar transporte WebSocket no ambiente de mocks, salvo se a integração instalada suportar e testar explicitamente outro transporte.
- Usar o namespace padrão e eventos de texto suportados. Documentar funcionalidades de protocolo não suportadas.
- Iniciar a interceptação e inicializar o estado antes de criar o cliente.
- Fornecer ciclo de vida explícito de conexão/desconexão. Não conectar durante importação de módulo nem a partir da tela provisória.
- Emitir `nft.updated` pela conexão Socket.IO interceptada após atualizar o estado.
- Não simular recebimento chamando diretamente um setter da interface, callback, listener ou atualização de cache Query pelo controlador de cenário.
- O código consumidor deve validar a estrutura do evento, rejeitar versões duplicadas/antigas do recurso e reconciliar entradas relevantes do cache Query.
- Invalidar consultas de lista quando mudanças de preço ou disponibilidade puderem afetar filtros, ordenação ou participação nas páginas.
- Após reconexão, reconciliar recursos NFT ativos via REST.
- Remover listeners no descarte. Conexões/desconexões repetidas não devem acumular handlers ou aplicar um evento mais de uma vez.

Fornecer uma forma determinística de injetar um evento duplicado e um antigo sem regredir o estado de referência. O servidor simulado pode reenviar envelopes históricos; o cliente deve ignorá-los.

Documentar os pontos futuros de extensão para assinaturas privadas, verificações de geração de sessão e `order.updated`, mas não implementar esses fluxos ainda.

## 5. Controles de cenários e testes

Fornecer pequenos controles exclusivos dos mocks para:

- Restauração integral da massa de dados padrão.
- Seleção de cenário determinístico nomeado.
- Configuração de atrasos de requisição ou falha de uso único.
- Atualização de preço ou disponibilidade de edição de um NFT.
- Envio de eventos duplicados/antigos de catálogo.
- Interrupção e restauração de conexão de socket.

Manter os controles na infraestrutura de mocks/testes, nunca em componentes de produção ou no cliente normal de API. Se uma ponte de navegador for exposta ao Playwright, condicioná-la a uma configuração explícita de teste e documentar sua API. Ela não deve aparecer em build normal ou na interface.

Não depender de variáveis globais efêmeras de um service worker para preservar estado após recarregamento. Não restaurar o estado persistido em reconexões normais do cliente.

## 6. Verificação

Usar uma estrutura exclusiva de testes que importe o código real de HTTP, Query e tempo real. Ela não deve adicionar página visível de desenvolvimento nem alterar o comportamento normal da tela provisória. Manter a estrutura habilitada separadamente e excluída da execução normal de produção.

Adicionar testes focados em:

1. Filtros, ordenação, paginação e resultados vazios de listagem por Axios e MSW.
2. Consulta de detalhe, parâmetros inválidos e respostas para NFT ausente.
3. Comparação precisa de valores ETH decimais, incluindo valores inseguros para comparação por conversão em ponto flutuante.
4. Recarregamento de estado persistido e restauração integral determinística.
5. Requisições lentas/fora de ordem: uma consulta antiga não deve substituir o resultado da consulta atualmente selecionada; o cancelamento é encaminhado.
6. Falhas HTTP/de rede e nova tentativa bem-sucedida após remover a falha injetada.
7. Atualização de NFT recebida pelo cliente Socket.IO real, com estados REST e Query consistentes depois.
8. Eventos duplicados/antigos não fazem o estado regredir nem reaplicam efeitos.
9. Desconexão, mudança no estado enquanto desconectado, reconexão e reconciliação REST de recurso ativo.
10. Limpeza de listeners em ciclos de conexão repetidos.

Evitar esperas arbitrárias. Aguardar condições observáveis de conexão, resposta, estado ou consulta, com limites de tempo. Usar contextos novos de navegador e restaurar a massa de dados entre testes. Condicionar a prontidão dos testes à conclusão da inicialização de estado/mocks.

Manter os testes básicos originais desktop/mobile da tela provisória e sua verificação de ausência de tráfego de negócio no modo normal da aplicação. Verificar que builds normais com mocks habilitados e desabilitados continuam renderizando somente a tela provisória.

Executar tipos, lint, formatação, build otimizado, testes básicos existentes e os novos testes de integração. Confirmar que o protocolo funciona no navegador com build otimizado e mocks habilitados, não apenas no servidor de desenvolvimento.

A configuração Lighthouse anterior permanece intacta. Repetir a auditoria completa é desnecessário, salvo se esta tarefa alterar sua configuração ou introduzir uma preocupação relevante de execução.

## 7. Documentação e passagem de contexto

Atualizar a documentação existente em vez de duplicá-la. Adicionar documentação específica de contratos, por exemplo:

```text
docs/contracts/rest.md
docs/contracts/events.md
docs/mock-scenarios.md
```

Incluir:

- Quais endpoints/eventos estão implementados e quais são somente contratos.
- Conteúdo da massa de dados e IDs estáveis úteis para testes.
- Versionamento do armazenamento, restauração, persistência e política de múltiplas abas.
- Comandos/controles de seleção e restauração de cenários.
- Chaves das consultas públicas de catálogo, cancelamento, novas tentativas, invalidação e reconciliação.
- Transporte do socket, versão da integração e limitações efetivamente verificadas.
- Instruções para reproduzir as verificações REST e de tempo real.
- Qualquer pacote adicional e o motivo de sua inclusão.
- Quais responsabilidades continuam adiadas para as etapas de sessão, carrinho, checkout e interface.

## Critérios de aceitação e condição de parada

- A interface normal permanece a tela provisória original.
- Requisições REST de NFT passam por Axios e MSW, retornando resultados determinísticos baseados no estado.
- Eventos Socket.IO trafegam pelo cliente real e pela interceptação compatível do MSW.
- Mudanças de preço/disponibilidade permanecem consistentes entre persistência, REST e consumidores de tempo real.
- Eventos duplicados, versões antigas, reconexões e descarte estão cobertos por verificações executáveis.
- Nenhum comportamento de autenticação, carrinho, checkout, conta ou pedido foi implementado além dos contratos e pontos de extensão documentados.
- Não houve trabalho no Figma, commit, push, alteração remota ou implantação.

Informar arquivos alterados, contratos/endpoints/eventos implementados, comandos de validação e resultados, além de limitações relevantes. Diferenciar claramente verificações executadas de suposições. **Parar aqui; não iniciar interface do marketplace nem implementação de compras.**
