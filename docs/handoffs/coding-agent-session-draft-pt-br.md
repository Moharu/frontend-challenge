# Próxima etapa: cadastro, login e sessão

## Objetivo

Segunda etapa do fluxo de compra: catálogo → NFT → carrinho → **login**. Implementar com a infraestrutura REST, Query, MSW e Socket.IO existente:

- cadastro, login e logout;
- sessão recuperada após refresh;
- expiração da sessão com preservação do contexto;
- retorno ao fluxo anterior depois de autenticar;
- isolamento de dados privados por usuário e por geração de sessão;
- mesclagem do carrinho do visitante no carrinho do usuário.

Fora desta etapa: checkout, cotação, pedidos, favoritos persistidos, perfil, carteiras, recuperação de senha e login social. "Conectar e finalizar" passa a exigir autenticação, mas, autenticado, continua levando ao aviso de indisponibilidade do checkout (seção 8).

## Ponto de partida e referências

- Repositório: https://github.com/Moharu/frontend-challenge
- Último commit revisado: `157f168` (carrinho do visitante e correções).
- Requisitos: `docs/challenge-requirements.md`, em especial "Conta e sessão" e os itens de sessão, troca de usuário e carrinho após login.
- Contratos e decisões existentes: `ARCHITECTURE.md`, `docs/contracts/rest.md`, `docs/contracts/events.md`, `docs/mock-scenarios.md`, `docs/cart.md` e `src/contracts/session.ts`.
- Figma: https://www.figma.com/design/Zbw0vAAPU80HoDwKVfAcCR/Frontend-Challenge--Copy-?node-id=0-1
- Implantação: Vercel. Não implantar nesta tarefa.

Inspecione o checkout atual e as instruções aplicáveis antes de editar. Preserve trabalho mais recente; não resete para o commit citado. Reutilize a stack e o lockfile existentes. Não crie repositório remoto, commit, push ou deploy sem autorização separada.

## Consulta ao design

Consulte o Figma em modo somente leitura ou as capturas desses frames fornecidas pelo usuário. Não altere o arquivo.

Frames desta etapa:

- Desktop / Login: `9:115`.
- Desktop / Cadastro: `9:1022`.
- Mobile / Login: `16:1022`.
- Mobile / Cadastro: `16:1228`.
- Cabeçalho autenticado, se existir: consulte o cabeçalho de Desktop / Perfil do Colecionador (`9:1238`) apenas para o estado logado do cabeçalho; não implemente o perfil.

Observações verificadas nas capturas, a confirmar no arquivo:

- **Desktop / Login:** modal sobre a página inicial (cabeçalho com "Início" ativo, hero e catálogo visíveis ao redor), **sem fundo escurecido**, com borda inferior cobre. Contém:
  - botão de fechar (×) no canto superior direito;
  - abas "Entrar" (ativa, em cobre) e "Criar conta", separadas por uma barra vertical;
  - o texto "Entre para gerenciar sua carteira, coleção e perfil de criador.";
  - os campos e-mail e senha (com ícone de mostrar/ocultar) e o link "Esqueceu a senha?" alinhado à direita;
  - o botão "Entrar", o divisor "Ou continue com" e os botões "Continuar com Google" e "Continuar com Facebook".
- **Desktop / Cadastro:** mesmo modal, com a aba "Criar conta" ativa (em cobre) e o texto "Crie seu perfil de colecionador e conecte uma carteira quando quiser.". Campos "Nome de usuário", "Digite seu e-mail", "Senha" (com mostrar/ocultar) e "Confirmar senha" (sem o ícone), seguidos do botão "Criar conta", do divisor "Ou continue com" e dos botões Google e Facebook. Não há link "Esqueceu a senha?" nesta aba.
- **Mobile / Login:** tela inteira, sem cabeçalho nem navegação inferior. Mostra a marca KURIO centralizada, o título "Entrar", e-mail, senha com mostrar/ocultar, "Esqueceu a senha?", o botão "Entrar", os botões Google e Facebook e o link "Novo na Kurio? Crie uma conta".
- **Mobile / Cadastro:** mesma estrutura, com o título "Criar perfil de colecionador", campos nome de usuário, e-mail, senha e confirmar senha (os dois últimos com mostrar/ocultar), o botão "Criar perfil" e o link "Já tem uma conta? Entre".

### Inconsistências e decisões de design

- **Rótulos apenas como placeholder.** Os campos usam o placeholder como único rótulo ("contato@email.com", "Nome de usuário", "Senha"). Placeholder não substitui label. Associe um label a cada campo, visualmente oculto se for preciso preservar a composição, e use placeholders coerentes com o campo (por exemplo "Digite seu e-mail" no login, em vez de um endereço que parece já preenchido).
- **Placeholder centralizado.** No cadastro mobile, "Nome de usuário" está centralizado, enquanto os demais campos alinham à esquerda. Alinhe todos à esquerda.
- **Sem saída no mobile.** As telas mobile não têm voltar nem fechar. Acrescente um botão "Voltar" acessível no padrão do cabeçalho mobile do carrinho, levando ao destino de retorno ou ao catálogo. Registre o desvio.
- **Modal sem fundo escurecido.** No desktop, preserve a composição sem escurecimento forte, mas o conteúdo atrás deve ficar inerte para teclado e leitores de tela (`aria-modal`, foco preso). Um fundo sutil é aceitável se ajudar a indicar o modal; registre a decisão.
- **Página atrás do modal.** O Figma mostra a página inicial. Com acesso direto a `/login`, renderize a página inicial atrás do modal. Ao abrir a partir de outra rota, decida entre manter a página de origem ou a inicial e documente.
- **Regras de senha.** O layout não exibe regras de senha nem de username. Mostre-as de forma discreta abaixo dos campos (seção 7).
- **Mostrar/ocultar na confirmação.** No cadastro desktop, só "Senha" tem o ícone; no mobile, "Senha" e "Confirmar senha" têm. Use o controle nos dois campos de senha, nas duas composições.
- **Texto do botão de cadastro.** O desktop usa "Criar conta"; o mobile usa "Criar perfil" com o título "Criar perfil de colecionador". Mantenha o texto de cada frame, com o mesmo nome acessível de formulário nos dois casos, e documente.

Não copie posições absolutas. O modal desktop segue as regras de diálogo já adotadas (foco preso, Escape, devolução do foco). Telas mobile respeitam teclado virtual, safe areas e zoom.

## 1. Rotas e retorno ao fluxo anterior

- Login e cadastro precisam de URLs reais (por exemplo `/login` e `/signup`) com acesso direto, refresh e histórico funcionando, inclusive no build otimizado.
- No desktop, a composição é o modal do Figma sobre a página do mercado. Fechar o modal (X ou Escape) leva ao destino de retorno ou ao catálogo. No mobile, as mesmas rotas renderizam as telas inteiras.
- O destino de retorno trafega em um search param validado (por exemplo `redirect`).
  - **Aceite somente caminhos internos da aplicação.** Rejeite URLs absolutas, `//host`, esquemas e caminhos fora das rotas conhecidas, usando o catálogo como fallback. Isso evita redirecionamento aberto e deve ter teste.
  - O destino preserva search params e hash da rota de origem, por exemplo filtros do catálogo.
- Alternar entre as abas "Entrar" e "Criar conta" preserva o destino de retorno.
- Usuário autenticado que acessa `/login` ou `/signup` é levado ao destino de retorno.
- Crie uma proteção de rota reutilizável para rotas privadas, a ser usada por checkout, perfil, carteiras, favoritos e pedidos nas próximas etapas. Nesta etapa, nenhuma rota privada nova é criada.

## 2. Contratos de sessão

Revise `src/contracts/session.ts`, `src/contracts/common.ts` e `docs/contracts/rest.md`. Endpoints já previstos: `POST /account/register`, `POST /session/login`, `GET /session` e `POST /session/logout`.

- **Transporte da sessão:** a API simulada emite um token opaco de sessão. O cliente o guarda para sobreviver ao refresh e o envia pelo Axios em requisições privadas. Registre em `ARCHITECTURE.md`, nas limitações, que um token acessível ao JavaScript é uma simplificação da simulação; em produção seria um cookie `HttpOnly`, `Secure` e `SameSite`.
- **Separar sessão de visitante.** Hoje, token de visitante desconhecido responde 401 `SESSION_INVALID`, e `mutate()` em `src/data/cart/api.ts` emite outro visitante silenciosamente. Com sessões reais, os dois casos não podem compartilhar o mesmo código.
  - Use um código próprio para visitante desconhecido, por exemplo 401 `VISITOR_INVALID`, e reserve `SESSION_INVALID` para sessão autenticada ausente, expirada ou revogada.
  - Só o tratamento de visitante pode emitir um novo visitante. Ao fazer isso, a interface informa que o carrinho anterior não está mais disponível, em vez de aplicar a operação em silêncio a um carrinho vazio.
- **Sessão:** `GET /session` retorna `id`, identidade do usuário, `expiresAt` e `generation`. `generation` muda a cada login, logout e troca de usuário, e serve para descartar respostas e eventos de uma sessão anterior.
- **Erros:**
  - Cadastro: 400 com `fields` (mensagens legíveis) e 409 para username ou e-mail já usados.
  - Login: 401 com mensagem genérica que não revela se o e-mail existe.
  - Rotas privadas: 401 `SESSION_INVALID` para sessão ausente, expirada ou revogada.
- Atualize a tabela de acompanhamento de `docs/contracts/rest.md`, separando o definido do implementado e verificado.

## 3. Servidor simulado: contas, senhas e sessões

- Persista contas e sessões no estado simulado com nova versão de esquema. `reset()` restaura um estado conhecido, sem apagar dados não relacionados da origem.
- **Senhas nunca em claro:** nem no estado persistido, nem em fixtures, logs, mensagens de erro ou snapshots de teste.
  - Use hash com sal via Web Crypto (por exemplo PBKDF2 com SHA-256 e iterações documentadas).
  - As contas fictícias `ada_example` e `lin_example` recebem senhas de demonstração documentadas no README como credenciais fictícias. A seed guarda somente o sal e o hash pré-calculados.
- **Validação de cadastro no servidor**, refletida no cliente:
  - username: 3 a 20 caracteres `[a-z0-9_]`, único sem diferenciar maiúsculas;
  - e-mail: formato válido, único e normalizado em minúsculas;
  - senha: no mínimo 8 caracteres, com pelo menos uma letra e um número.

  Ajuste os limites somente com justificativa documentada.
- O cadastro cria a conta, o perfil inicial (`displayName` nulo, conforme o contrato) e já autentica.
- **Validade da sessão:** duração documentada. Para testes determinísticos, adicione controles de cenário que expiram ou revogam a sessão atual, apenas na estrutura de mocks e testes, sem endpoint público.
- **Logout** revoga a sessão no servidor; um token revogado não volta a funcionar.
- Respeite o mesmo tratamento de falhas e atrasos de cenário já usado (503 transitório e falha de rede) nos novos endpoints.

## 4. Carrinho do usuário e mesclagem

O requisito pede "preservar os itens do visitante ao autenticar".

- Cada usuário tem um carrinho próprio no servidor, persistido entre sessões e dispositivos simulados. Requisições autenticadas usam o carrinho do usuário; sem sessão, o do visitante.
- **Mesclagem no login e no cadastro**, executada no servidor uma única vez, de forma atômica, a partir do token do visitante:
  - Linhas da mesma edição somam as quantidades. Edições diferentes são acrescentadas.
  - **Sem redução silenciosa:** se a soma ultrapassar o limite efetivo, a linha fica marcada com o conflito existente (`QUANTITY_ABOVE_LIMIT` ou `SOLD_OUT`), e o usuário corrige no carrinho.
  - Cupom: se só um dos carrinhos tiver cupom, ele é mantido; se ambos tiverem, prevalece o do visitante, que é a intenção mais recente. Documente a regra.
  - Depois da mesclagem, o carrinho do visitante é consumido. Repetir o login com o mesmo token não duplica itens.
- A resposta de login informa o resultado da mesclagem (por exemplo, linhas adicionadas e linhas em conflito). A interface anuncia isso de forma acessível, sem diálogo bloqueante.
- **Logout:** o carrinho do usuário permanece na conta. A interface volta a um carrinho de visitante vazio, e nenhum item do usuário fica visível.
- **Troca de usuário:** o usuário B nunca vê itens, cupom ou contagem do usuário A, nem por um instante de cache.

## 5. Isolamento no cliente

- Chaves Query de dados privados incluem o escopo da identidade. Exemplo: `['cart', { kind: 'visitor', token }]` ou `['cart', { kind: 'user', userId, generation }]`.
  - Atualize a regra `keepNewestCart` para comparar somente carrinhos do mesmo escopo.
  - Atualize a invalidação em tempo real, o badge e a ponte de testes que hoje usam `['cart']`.
- Login, logout, expiração e troca de usuário, nesta ordem:
  1. cancelam requisições privadas em andamento;
  2. removem do cache os dados privados da identidade anterior;
  3. descartam respostas tardias de uma geração anterior.
- Prepare o consumidor de tempo real para eventos privados: ao mudar a sessão, listeners privados futuros são liberados, e eventos com geração diferente são ignorados. Nenhum evento privado é emitido nesta etapa. Não crie uma segunda conexão pública.
- **Recuperação no carregamento:** `GET /session` não pode bloquear a renderização das páginas públicas. Enquanto a sessão não for conhecida, o cabeçalho mostra um estado neutro, sem piscar "Entrar" para quem está autenticado. Meça o impacto no Lighthouse (seção 10).

## 6. Expiração durante a navegação

- Uma resposta 401 `SESSION_INVALID` em requisição privada encerra a sessão local e aplica o passo 5 com uma mensagem acessível: "Sua sessão expirou. Entre novamente para continuar."
- O usuário vai ao login com o destino de retorno da página atual. Ao autenticar de novo, volta ao mesmo lugar, com search params e hash preservados.
- Não perca o contexto público: catálogo e filtros continuam funcionando sem sessão.
- O carrinho do usuário continua salvo no servidor e reaparece após o novo login.
- Preservar rascunhos de checkout após a expiração é tarefa da etapa de checkout. Deixe o mecanismo de retorno pronto para receber esse estado.

## 7. Telas de login e cadastro

- Desktop e mobile conforme os frames, compartilhando validação e lógica.
- Labels associados, mensagens de erro de campo vinculadas aos inputs (`aria-describedby`) e foco no primeiro campo inválido ao enviar.
- Erros da API aparecem nos campos correspondentes (`fields`) ou em um resumo acessível.
- Botão de mostrar/ocultar senha com nome acessível e estado (`aria-pressed` ou equivalente).
- A confirmação de senha é validada apenas no cliente e não trafega na API, conforme o contrato.
- Envio pendente bloqueia reenvios. Falha transitória e de rede preservam o que foi digitado.
- Mostre ao usuário as regras de senha e username antes do erro, não apenas depois.
- `autocomplete` adequado: `email`, `username`, `current-password` e `new-password`.

## 8. Cabeçalho, navegação e ações dependentes de login

- **Desktop:** "Entrar" leva a `/login` com o destino de retorno da página atual. Autenticado, mostre a identidade (username ou nome de exibição) com um menu acessível contendo "Sair". Itens de perfil e carteiras usam o aviso de indisponibilidade até as próximas etapas.
- **Mobile:** o ícone "Minha conta" leva ao login quando deslogado. Autenticado, abre um menu ou folha acessível com a identidade e "Sair", e o perfil continua indisponível.
- **"Conectar e finalizar":** deslogado, leva ao login com retorno a `/cart`; autenticado, continua no diálogo de indisponibilidade do checkout. Atualize o texto do diálogo.
- **Favoritar:** continua com o padrão atual de indisponibilidade nesta etapa.
- **"Esqueceu a senha?", "Continuar com Google" e "Continuar com Facebook":** usam o diálogo de indisponibilidade. Não simule envio de e-mail nem OAuth.

## 9. Responsividade e acessibilidade

- Verifique 390, 414, 768 e 1440px. Em 768px, documente se a composição é o modal ou a tela inteira, e por quê.
- Modal desktop: foco inicial no primeiro campo, foco preso, Escape fecha, foco devolvido ao gatilho e abas acessíveis entre "Entrar" e "Criar conta".
- Anúncios acessíveis para login, logout, expiração e resultado da mesclagem, sem repetição excessiva.
- Contraste, foco visível e ausência de overflow horizontal com zoom.

## 10. Testes e verificação

Preserve as suítes existentes. Adicione testes observando a interface e passando pelos handlers MSW reais:

1. Cadastro válido autentica e retorna ao destino. Erros de validação aparecem por campo, e username ou e-mail duplicados retornam 409.
2. Login inválido mostra mensagem genérica; login válido com as credenciais fictícias do README.
3. Refresh mantém a sessão; acesso direto a `/login` autenticado redireciona.
4. Logout revoga o token: requisições com o token antigo falham, e a interface volta ao carrinho de visitante vazio.
5. Troca de usuário A → B sem exibir dados de A em nenhum momento, incluindo badge e cache.
6. Mesclagem: somas, edições novas, conflito sem redução silenciosa, regra de cupom e ausência de duplicação ao repetir o login.
7. Retorno ao fluxo: do carrinho ("Conectar e finalizar") e do catálogo com filtros, preservando search params e hash.
8. Redirecionamento aberto rejeitado (URL absoluta, `//host`, esquemas).
9. Expiração por controle de cenário durante a navegação: mensagem, login com retorno ao mesmo lugar e carrinho do usuário preservado.
10. Resposta tardia de uma sessão anterior não altera os dados da sessão atual.
11. Token de visitante desconhecido (após reset) é tratado como visitante, com aviso, sem confundir com sessão expirada.
12. Teclado e foco no modal desktop e nas telas mobile; "Esqueceu a senha?" e login social informam indisponibilidade.
13. Nenhuma senha em claro no localStorage, no estado persistido ou em respostas da API.

Execute os fluxos principais em Chromium desktop e mobile. Referências visuais de login e cadastro são opcionais. Se criadas, inspecione-as antes de aceitar e compare com os frames.

Execute tipos, lint, formatação, build, build de integração, testes de integração e E2E. Rode o Lighthouse em início e detalhe (três medições por página e perfil, medianas, LCP, CLS e TBT) e registre a comparação com a etapa anterior, em especial o efeito de `GET /session` no carregamento.

## 11. Documentação e entrega

Atualize README, arquitetura, contratos e cenários em pt-BR. Inclua:

- credenciais fictícias e como redefinir o estado;
- política de sessão: transporte, validade, geração, expiração, revogação e a limitação do token acessível ao JavaScript;
- regra de retorno ao fluxo e a validação contra redirecionamento aberto;
- regra de mesclagem do carrinho, incluindo cupom e conflitos;
- isolamento de cache e de assinaturas por usuário e geração;
- separação entre erro de visitante e erro de sessão;
- desvios do Figma e adaptadores de indisponibilidade que permanecem;
- evidências executadas, resultados do Lighthouse e o que não foi verificado.

Ao concluir, informe arquivos alterados, fluxos entregues, resultados de testes e auditorias e eventuais desvios visuais. Não declare o desafio inteiro concluído.

**Pare após cadastro, login e sessão. Não avance para checkout, cotação, pedidos, favoritos persistidos, perfil, carteiras, commit, push ou deploy sem nova autorização.**
