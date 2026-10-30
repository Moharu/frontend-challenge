# Etapa final: correções, acessibilidade, testes, documentação e entrega

## Objetivo

Fechar a entrega contra `docs/challenge-requirements.md`, sem funcionalidades novas:

1. **Correções de defeitos** encontrados numa revisão independente, começando pelos de maior risco.
2. **Acessibilidade:** auditoria automatizada e manual dos itens obrigatórios da seção 8, com correções.
3. **Testes:** garantir que os 12 grupos E2E da seção 9 estão cobertos, executáveis e fáceis de encontrar.
4. **Documentação:** README e `ARCHITECTURE.md` completos conforme a seção 12, e o novo documento de rastreabilidade dos requisitos.
5. **Pendências registradas nas revisões anteriores.**
6. **Entrega:** execução a partir de um clone limpo, auditoria oficial final e verificação de que o site publicado corresponde ao commit final.

Fora desta etapa: funcionalidades novas, otimizações de desempenho além de corrigir regressões que esta etapa causar, e a revisão de fidelidade visual com o Figma, que **o usuário fará pessoalmente**. Não faça comparação visual com o Figma; se o usuário pedir ajustes visuais depois da revisão dele, eles virão em outra rodada.

## Ponto de partida e referências

- Repositório: https://github.com/Moharu/frontend-challenge
- Último commit revisado: `cc99ff5` (passada de desempenho), publicado em produção (implantação `dpl_EW7njgBqvQMWtENVdxEzDAtCF1WJ`, estado READY). Relatórios oficiais em `docs/lighthouse/` e análise em `docs/performance.md`.
- URL publicada: https://jungle-gaming-challenge-joao.vercel.app (projeto `jungle-gaming-challenge-joao`, implantação automática a cada push em `main`).
- Requisitos: `docs/challenge-requirements.md`, em especial as seções 8 (interface e acessibilidade), 9 (testes), 10 (Lighthouse), 11 (critérios e eliminatórios) e 12 (entrega).
- Documentação existente: `README.md`, `ARCHITECTURE.md`, `docs/*.md`, `docs/contracts/`, `docs/*-verification.md`, `docs/performance.md` e `docs/handoffs/`.
- Figma: https://www.figma.com/design/Zbw0vAAPU80HoDwKVfAcCR/Frontend-Challenge--Copy-?node-id=0-1

Inspecione o checkout atual antes de editar e preserve trabalho mais recente. Commit e push exigem autorização do usuário; cada push em `main` reimplanta o site.

## 1. Defeitos de uma revisão independente

Uma revisão de outro agente apontou os defeitos abaixo, já avaliados pelo revisor do projeto. Para cada um:

- reproduza o defeito com um teste que falhe antes da correção;
- corrija;
- mantenha o teste como regressão.

Se algum não se reproduzir, registre como foi verificado em vez de ignorá-lo. As referências de linha são da revisão e podem ter mudado.

### Crítico (corrigir primeiro)

1. **Mutations da conta executadas como o próximo usuário.** A fila de favoritos lê a sessão atual no momento em que cada requisição executa, sem conferir o escopo de origem.
   - **Reprodução relatada:** favoritar e desfavoritar com a primeira requisição atrasada e trocar de conta antes de ela terminar. A remoção enfileirada executa como o segundo usuário.
   - **Perfil:** o "Salvar" tem o mesmo risco entre as requisições sequenciais (dados, avatar, senha). Uma troca de usuário no meio poderia aplicar avatar ou senha à conta errada.
   - **Por que é crítico:** é uma alteração de dados entre usuários, ligada ao critério eliminatório de exposição de dados entre usuários.
   - **Correção:** cada requisição fica vinculada à identidade que a iniciou (token e geração capturados no clique) e é enviada com essa identidade. Quando a identidade muda, o trabalho enfileirado para, sem enviar nada com a sessão nova. Revise as demais filas ou sequências de mutations privadas (carrinho, carteiras, checkout, pedidos) com o mesmo critério e documente.
2. **Aplicar filtros não reinicia a paginação.** O formulário de filtros envia o rascunho normalizado inteiro, inclusive a página atual. Estando na página 3, escolher uma categoria com uma única página mostra o catálogo vazio, apesar de haver NFTs. "Mudanças de filtro reiniciam a paginação" é requisito explícito, avaliado no grupo E2E 1, e o defeito é visível para quem avaliar. **Correção:** `page: 1` explícito ao aplicar filtros (desktop e drawer mobile), ao mudar busca, modo e ordenação, com teste que parta de uma página maior que 1.

### Importante

3. **Expiração da sessão destrói a recuperação de uma compra não resolvida.** Se a resposta de um pedido se perde e a nova tentativa recebe 401 `SESSION_INVALID`, `sendOrder()` apaga a chave de idempotência e o corpo guardados. Depois de entrar de novo na mesma conta, a compra não pode mais ser recuperada pela nova tentativa, embora o pedido original possa já estar confirmado. **Correção:** preserve a tentativa não resolvida durante a expiração (ela é descartada só no logout explícito e na troca de usuário, como o rascunho) e retome-a depois de autenticar o mesmo usuário.
4. **Salvamento parcial do perfil apaga edições.** Se os dados do perfil falham por erro de rede ou 5xx e o avatar é salvo, o formulário substitui os campos editados pelos valores antigos do servidor, porque esses erros não têm `fields` e todos os campos são tratados como salvos. **Correção:** preserve as edições de dados sempre que a operação de dados falhar, com ou sem `error.fields`.
5. **A nova tentativa do pedido para de funcionar quando a gravação no `sessionStorage` falha.** `save()` captura o erro de armazenamento, mas não tem o fallback em memória que o comentário promete. Depois de uma falha de rede, "Tentar novamente" não encontra a tentativa guardada e não faz nada; a revisão confirmou forçando a falha de gravação. **Correção:** mantenha a tentativa pendente também em memória e nunca deixe o botão sem efeito nem aviso.
6. **Sessões revogadas ou expiradas continuam recebendo pedidos pelo socket.** É a mesma pendência do item 1 da seção 5; trate-a lá.

Verifique as referências visuais exigidas (início, detalhe, carrinho e pagamento) só se alguma correção mudar a interface, inspecionando cada diferença antes de aceitar.

## 2. Acessibilidade

Itens obrigatórios da seção 8: teclado e foco visível, foco em diálogos e drawers, semântica, labels e erros associados, alternativas textuais, contraste e estados não dependentes só de cor, feedback acessível de mutations e tempo real, e ausência de overflow e perda de conteúdo com zoom.

- **Auditoria automatizada.** Adicione uma verificação com axe (por exemplo `@axe-core/playwright`, só em desenvolvimento; justifique a dependência) que percorra todas as rotas e os estados principais: catálogo com filtros e drawer, detalhe, carrinho com e sem itens, login e cadastro, checkout nos três passos mobile e na página desktop, pedido pendente, confirmado e recusado, perfil, carteiras, Lista de interesse e as páginas não implementadas. Corrija as violações. Exceções justificadas ficam registradas no teste e na documentação.
- **Teclado.** Percorra os fluxos principais só com teclado (comprar do catálogo ao recibo, entrar, editar perfil e carteira, favoritar) e registre o roteiro e o resultado. A ordem de tabulação deve ser lógica, o foco sempre visível e sem armadilhas fora dos diálogos.
- **Zoom e reflow.** Verifique 200% de zoom e a largura de 320 px equivalente (reflow do WCAG 1.4.10) sem perda de conteúdo nem rolagem horizontal indevida, inclusive nas barras fixas do mobile.
- **Contraste:** não faça verificações nem ajustes de contraste de cor nesta etapa (decisão do usuário). Desative ou exclua a regra `color-contrast` na verificação com axe, registrando a exclusão e o motivo.
- **Movimento reduzido.** Confirme que shimmer, progresso do pedido, rolagens suaves e transições respeitam `prefers-reduced-motion`.
- **Leitores de tela.** Revise os nomes acessíveis, os marcos (`header`, `nav`, `main`, `footer`) e as regiões de status. Se possível, faça uma passada manual com um leitor de tela e registre o que foi verificado e o que não foi.
- Registre tudo em `docs/accessibility.md`.

## 3. Testes

- **Mapa dos 12 grupos.** Para cada grupo da seção 9, liste no README (ou em `docs/testing.md` com link no README) os arquivos e testes que o cobrem, com o comando para rodá-los. Se algum grupo estiver coberto só parcialmente, complete-o. Confira em especial:
  - o grupo 3 (troca de usuário);
  - o grupo 7 (falha de pagamento, clique repetido e timeout);
  - o grupo 10 (eventos duplicados ou antigos, desconexão e retomada do pedido pendente);
  - o grupo 12 (skeleton, falha e nova tentativa).
- **Comando único.** Hoje os fluxos ficam na suíte de integração (`npm run test:integration`, com o build de integração), e `npm run test:e2e` cobre só o build normal e as referências visuais. Quem avalia pode rodar apenas `test:e2e` e concluir que há poucos testes.
  - Ofereça um comando único e evidente que rode tudo na ordem certa (por exemplo `npm test` ou `npm run test:all`, incluindo os builds necessários).
  - Explique no README a diferença entre as suítes e por que a ponte de testes só existe no build de integração.
- **Relatório e traces.** Confirme que as suítes geram relatório HTML e traces das falhas, como exige a seção 9, e documente onde ficam e como abri-los.
- **Isolamento e tempo.** Confirme que cada teste parte de estado isolado e que os cenários sensíveis a tempo controlam relógio, latência e disparo de eventos, sem esperas fixas.
- **Eliminatórios.** Revise e cite no documento de rastreabilidade a evidência de cada critério eliminatório da seção 11:
  - uso efetivo da stack obrigatória;
  - fluxos principais funcionais;
  - compra confirmada só com resposta da simulação;
  - nenhuma exposição de dados entre usuários;
  - eventos nunca simulados diretamente na interface;
  - testes E2E executáveis.

## 4. Documentação

### 4.1 README

Confira e complete, conforme a seção 12:

- setup a partir de um clone limpo (Node e npm exigidos, instalação);
- variáveis de ambiente;
- credenciais fictícias e cupons de demonstração;
- **seleção e reset dos cenários,** e **instruções para reproduzir os fluxos de falha:** pagamento recusado, timeout depois da criação do pedido, expiração de sessão, mudança de preço ou disponibilidade no checkout, desconexão do socket, falhas HTTP e de rede. Explique como fazer isso localmente com o build de integração e os controles da ponte de testes (por exemplo, pelo console do navegador) e o que é possível no site publicado, que não tem a ponte;
- comandos de desenvolvimento com mocks, build, preview, tipos, lint, testes Playwright (com o comando único) e auditoria Lighthouse;
- URL publicada e commit verificado;
- um índice da documentação em `docs/`.

### 4.2 `ARCHITECTURE.md`

A seção 12 exige nele: contratos REST e eventos, política de sessão, estado do carrinho, estratégia de cache, reconciliação entre REST e Socket.IO, limitações, decisões de UX e desvios do Figma.

- Confira cada item. Resuma-o no próprio arquivo com links para os documentos detalhados.
- **Consolide os desvios do Figma**, hoje espalhados por `docs/discovery.md`, `cart.md`, `session.md`, `checkout.md`, `orders.md` e `account.md`, numa seção única, com uma linha por desvio e o link para a decisão.
- Remova afirmações desatualizadas, como "nenhum projeto foi vinculado ou implantado", e garanta que cada documento descreve o estado final.

### 4.3 Rastreabilidade dos requisitos (pedido do usuário)

Crie `docs/requirements-traceability.md`, em pt-BR, com link no README:

- Segue **a mesma ordem e os mesmos títulos** de `docs/challenge-requirements.md`, com uma entrada por parágrafo ou item de lista, para leitura lado a lado.
- **Cada entrada tem:**
  - status: **atendido**, **parcial** ou **fora do escopo / não atendido**;
  - um resumo de alto nível de como o requisito é cumprido;
  - links para o documento detalhado, o código principal e os testes que o comprovam.
- **Status honestos.** Um resultado abaixo da meta fica "parcial", com link para a evidência e a causa.
- A tabela de critérios de avaliação e cada critério eliminatório da seção 11 têm entradas próprias, apontando para a evidência.
- **Desempenho.** A entrada da seção 10 deixa claro que:
  - as metas foram atingidas na medição oficial da URL publicada (mobile 92 no início e no detalhe, desktop 100);
  - a referência local fica abaixo no mobile, com a causa documentada em `docs/performance.md`;
  - a margem no mobile é estreita: uma das três execuções do início marcou 89, e medições em outras máquinas podem oscilar.

  Explique como reproduzir a medição oficial.

## 5. Pendências das revisões anteriores

1. **Eventos privados para sessões revogadas.** O servidor simulado verifica o token do socket só no momento da autenticação. Quando uma sessão é revogada (troca de senha, logout em outra aba ou expiração), a conexão autenticada com ela continua recebendo `order.updated` até o cliente se autenticar de novo. Faça a entrega de eventos privados conferir se a sessão da conexão continua ativa (ou desassociar as conexões das sessões revogadas no momento da revogação) e teste os três casos.
2. **Comentário desatualizado** em `src/routes/account.tsx` (por volta da linha 55): diz que o menu da conta no mobile expande "inline", mas ele abre sobreposto ao conteúdo, por decisão do usuário. Atualize o comentário.
3. **Escape nos diálogos aninhados** (opcional): pressionar Escape antes de o aviso de indisponibilidade terminar de abrir, dentro do login, fecha os dois diálogos. Hoje só o teste espera o foco. Corrija no componente se for simples; caso contrário, registre como limitação.
4. **Checkout com pedido pendente** (opcional): com um pedido pendente para o carrinho, o checkout abre normalmente e só no envio leva ao pedido existente. Se for simples, mostre no checkout o mesmo aviso do carrinho, com link para o pedido.

## 6. Entrega

- **Clone limpo:** num diretório novo, clone o repositório, rode `npm ci` e todos os comandos documentados (tipos, lint, formatação, build, build de integração, testes de integração, E2E e o comando único). Registre o resultado.
- **Auditoria oficial final:** se esta etapa alterou código que afeta o carregamento ou a interface, rode uma última vez a auditoria Lighthouse oficial (URL publicada, três execuções por página e perfil) **no commit final publicado**. Atualize `docs/lighthouse/` e `docs/performance.md`, para que os relatórios entregues correspondam ao código entregue. Sem mudanças relevantes, registre que os relatórios da passada de desempenho continuam válidos e por quê.
- **Site publicado:** depois do push final autorizado, confirme na Vercel que a implantação de produção corresponde ao commit final. Rode `npm run test:deploy` contra a URL e atualize `docs/deploy-verification.md` e o README com o commit verificado.
- Lembre o usuário, no relatório final, de que o projeto precisa permanecer ativo e acessível durante a avaliação.

## 7. Verificação e entrega

Execute tipos, lint (com `check:bom`), formatação, build, build de integração, testes de integração, E2E, a verificação de acessibilidade e `npm run test:deploy`, com o limite de workers configurado. O Lighthouse só roda na auditoria oficial final da seção 6, se necessária.

**Fique atento a erros de infraestrutura** ("Target crashed", navegador fechado, timeout do servidor de pré-visualização, falta de memória, processo encerrado) e a falhas que só aparecem na suíte completa. Registre-os nos documentos de verificação desta etapa, investigue as repetições em vez de usar retentativas e confirme ao final que não ficaram navegadores, servidores de pré-visualização nem perfis temporários órfãos.

Peça autorização ao usuário antes de cada commit e push.

Ao concluir, informe arquivos alterados, como cada defeito da seção 1 foi reproduzido e corrigido, as correções de acessibilidade, o mapa dos testes, os resultados de todas as verificações, a URL e o commit publicados. Inclua um resumo do documento de rastreabilidade com os itens "parcial" e "fora do escopo".

**Pare ao fim desta etapa.** Não declare o desafio concluído antes de o usuário revisar.
