# Próxima etapa: checkout até a revisão validada

## Objetivo

Terceira etapa do fluxo de compra: catálogo → NFT → carrinho → login → **checkout**. Implementar, com a infraestrutura REST, Query, MSW e Socket.IO existente:

- página de pagamento protegida, em desktop e mobile;
- dados do colecionador, preenchidos a partir da conta e da carteira;
- seleção de carteira cadastrada (que define a rede) e simulação de conexão, recusa e desconexão;
- cadastro de carteira dentro do checkout, quando o usuário não tiver uma adequada;
- cotação calculada pela API, com revalidação antes de confirmar e nova confirmação do usuário quando algo mudar;
- preservação do rascunho do checkout na expiração da sessão.

**Limite desta etapa:** "Confirmar compra" faz a revalidação final e, se nada mudou, mostra o diálogo honesto de que a criação de pedidos chega na próxima etapa. Não criar pedido, chave de idempotência, recibo, evento `order.updated` nem tela de confirmação. Também fora: edição de carteiras e a página de carteiras, perfil, favoritos e login social.

## Ponto de partida e referências

- Repositório: https://github.com/Moharu/frontend-challenge
- Último commit revisado: `fcf352e` (sessão e correções).
- Requisitos: `docs/challenge-requirements.md`, em especial "Pagamento", checkout, carteiras, revalidação e expiração durante o checkout.
- Contratos e decisões existentes: `ARCHITECTURE.md`, `docs/contracts/rest.md` (seção "Complementação dos campos dos formulários"), `docs/contracts/events.md`, `docs/mock-scenarios.md`, `docs/cart.md`, `docs/session.md` e `src/contracts/{checkout,wallets,quotes,orders}.ts`.
- Figma: https://www.figma.com/design/Zbw0vAAPU80HoDwKVfAcCR/Frontend-Challenge--Copy-?node-id=0-1
- Implantação: Vercel. Não implantar nesta tarefa.

Inspecione o checkout atual e as instruções aplicáveis antes de editar. Preserve trabalho mais recente; não resete para o commit citado. Reutilize a stack e o lockfile existentes. Não crie repositório remoto, commit, push ou deploy sem autorização separada.

## Consulta ao design

Consulte o Figma em modo somente leitura ou as capturas fornecidas pelo usuário. Não altere o arquivo.

Frames desta etapa:

- Desktop / Pagamento: `11:2862`.
- Mobile / Pagamento: `16:748`.
- Desktop / Confirmação de Pedido: `11:4385`, apenas como referência do que vem depois. Não implemente a confirmação.

Observações verificadas nas capturas, a confirmar no arquivo:

- **Desktop:** breadcrumb "Início / Mercado / Pagamento". Duas colunas.
  - **Esquerda, "Perfil do colecionador":**
    - campos "Nome de exibição", "Nome de usuário", "Rede" (select), "Nome do perfil", "Endereço da carteira" (placeholder "Endereço 0x da carteira"), "ENS ou carteira secundária (opcional)", "Tipo de carteira" (select), "Código de indicação", "E-mail" e "Nome ENS" (com seletor `.eth`);
    - opção "Usar outra carteira?";
    - "Observação do colecionador (opcional)".
  - **Direita, "Seus NFTs":** linhas com arte, nome, ID do token, quantidade e subtotal, além de:
    - "Tem um código promocional? Aplique aqui";
    - Subtotal, "Desconto do lançamento", "Taxa de rede" com "Taxa estimada" e Total;
    - bloco "Carteira e rede" com opções de rádio (selo de carteiras compatíveis, MetaMask, Coinbase Wallet);
    - botão "Confirmar compra".
- **Mobile, "Pagamento com carteira":** botão voltar.
  - "Carteira conectada", com o link "Trocar carteira" e cartões de carteiras cadastradas: "Reserva" (`nova.kurio.eth`, Rede Polygon) e "Principal" (`0xA91F…E82C`, Rede principal Ethereum), cada um com menu "⋮".
  - "Carteira e rede", com opções de provedor (WalletConnect, MetaMask, Coinbase Wallet).
  - "Total" e o botão "Confirmar compra" fixo na parte inferior.

### Inconsistências e decisões de design

- **Campos opcionais com asterisco.** "Código de indicação" e "Nome ENS" têm asterisco, mas já foi decidido que são opcionais (`docs/contracts/rest.md`). Remova o asterisco desses campos e documente.
- **Rede e tipo de carteira vêm da carteira.** A rede e o provedor pertencem à carteira cadastrada (contrato atual): o backend resolve endereço, rede e provedor a partir de `walletId`. "Rede", "Tipo de carteira" e "Endereço da carteira" mostram os dados da carteira selecionada, como campos somente leitura ou equivalentes visuais. Trocar a carteira os atualiza. Documente o desvio dos selects.
- **Lista de provedores segue a carteira cadastrada.** A opção do provedor da carteira selecionada vem marcada. Escolher outro provedor seleciona a carteira cadastrada do usuário com esse provedor; se não houver, oferece cadastrar uma (seção 4). No desktop, a primeira opção é o selo "METAMASK • WALLETCONNECT • COINBASE". Trate-a como WalletConnect, com o mesmo padrão das demais, e documente.
- **Taxa no checkout.** Com a carteira escolhida, a taxa é a da rede dela, não mais estimada. Troque a legenda "Taxa estimada" pela rede efetiva (por exemplo "Taxa de rede (Polygon)").
- **Resumo no mobile.** O frame mobile mostra só o Total. O requisito pede subtotal, desconto, taxa e total coerentes com a API. Inclua o resumo completo na revisão mobile (seção 3) e documente.
- **Menu "⋮" das carteiras.** Edição de carteira fica para a etapa de carteiras. O menu usa o diálogo de indisponibilidade.
- **Valores desenhados.** Os do Figma são exemplos (o total mobile, 8.936 ETH, não corresponde aos itens). Todos os valores vêm da cotação da API.
- **Cabeçalho.** O frame mostra "Entrar", mas o checkout exige autenticação. Use o cabeçalho autenticado já implementado.

## 1. Rota, proteção e preservação do rascunho

- Rota `/checkout` protegida por `requireSession` e pelo `SessionCheckError`, com acesso direto e refresh funcionando.
- **Vindo do carrinho:** "Conectar e finalizar", autenticado, passa a levar a `/checkout`. Deslogado, continua indo ao login com retorno a `/checkout`. Remova o diálogo de indisponibilidade do carrinho.
- **Pré-condições:** carrinho vazio ou com conflitos não abre o checkout. Redirecione ao carrinho com explicação acessível.
- **Rascunho:** os dados digitados e a carteira escolhida ficam em `sessionStorage`, com chave pelo `userId`.
  - Sobrevivem a refresh e à expiração da sessão. Depois de entrar de novo com o mesmo usuário, o checkout volta preenchido, como pede o requisito.
  - São descartados no logout e na troca de usuário.
  - Não guarde no rascunho estado de conexão de carteira nem valores de cotação: a cotação é sempre buscada de novo.
- Expiração durante o checkout usa o fluxo já existente (aviso, login com retorno a `/checkout`).

## 2. Carteiras cadastradas e seed

Implemente no MSW `GET /wallets` e `POST /wallets` conforme `src/contracts/wallets.ts`. Edição (`PATCH /wallets/:id`) fica para a etapa de carteiras.

- **Seed:** `ada_example` recebe duas carteiras, como no frame mobile:
  - "Principal": `primary`, Ethereum, MetaMask, com um endereço `0x` completo e válido que exiba como `0xA91F…E82C`;
  - "Reserva": `secondary`, Polygon, Coinbase Wallet, com endereço válido e `ensName` `nova.kurio.eth`.

  Preencha os campos descritivos (displayName, profileName e email) de forma coerente com a conta. `lin_example` começa **sem carteiras**, para exercitar o cadastro dentro do checkout.
- **Validação no servidor e no cliente, com validadores compartilhados nos contratos** (como em `registrationErrors`):
  - endereço por rede: Ethereum e Polygon `^0x[0-9a-fA-F]{40}$`; Solana em base58, de 32 a 44 caracteres;
  - endereço único por usuário;
  - no máximo uma carteira `primary` por usuário;
  - provedor entre os três suportados.
- **Isolamento:** carteiras são dados privados, com chave Query no mesmo escopo de usuário e geração usado pelo carrinho, e limpas no logout, na expiração e na troca de usuário.
- A primeira carteira cadastrada por um usuário sem carteiras vira `primary`; as seguintes, `secondary`. Documente a regra.

## 3. Página de pagamento

**Desktop:** página única, conforme o frame. A coluna da direita é o resumo da cotação e a área de confirmação.

**Mobile:** três passos, com o passo atual em search param validado (por exemplo `?step=dados|carteira|revisao`), funcionando com voltar, avançar e refresh:

1. **Dados do colecionador:** os campos da coluna esquerda do desktop, em coluna única.
2. **Carteira:** o frame "Pagamento com carteira": carteiras cadastradas, provedores e total.
3. **Revisão:** itens, resumo completo da cotação, carteira e rede escolhidas, e "Confirmar compra".

Não é possível avançar com o passo atual inválido. Redimensionar entre desktop e mobile preserva os dados, porque o estado é o mesmo.

**Campos do colecionador**, conforme `CheckoutCollectorData`:

- **Obrigatórios:** nome de exibição, nome de usuário, e-mail e nome do perfil.
- **Opcionais:**
  - código de indicação: letras maiúsculas, números e hífen, de 4 a 20 caracteres;
  - nome ENS: rótulo `[a-z0-9-]` de 3 a 63 caracteres, com o sufixo `.eth` fixo;
  - ENS ou carteira secundária: endereço válido para a rede da carteira, ou um nome ENS;
  - observação: até 500 caracteres.
- **Pré-preenchimento:** primeiro pelos dados descritivos da carteira selecionada, depois pela identidade da conta (username, e-mail, nome de exibição). O que o usuário digita nunca é sobrescrito ao trocar de carteira; só campos ainda vazios são preenchidos.
- Alterar dados no checkout **não** atualiza conta nem carteira, conforme a seção "Propriedade e significado dos campos" de `docs/contracts/rest.md`.
- Labels associados, erros por campo vinculados e foco no primeiro campo inválido, no mesmo padrão do login e cadastro.

**Cupom no checkout:** "Tem um código promocional? Aplique aqui" abre o mesmo campo do carrinho e usa os endpoints de cupom do carrinho. Aplicar ou remover gera nova cotação.

## 4. Seleção e conexão de carteira

- O usuário escolhe uma carteira cadastrada (cartões no mobile, "Usar outra carteira?" no desktop, ambos com rádios acessíveis). A rede da carteira define a rede e a taxa do pedido.
- **"Usar outra carteira?" e "Trocar carteira":** listam as outras carteiras cadastradas e oferecem "Cadastrar nova carteira".
  - O formulário pede endereço, rede, provedor e rótulo (os demais campos descritivos são opcionais) e chama `POST /wallets`.
  - Depois de cadastrada, a carteira fica selecionada.
  - Erros do servidor aparecem nos campos.
- **Simulação de conexão, sem extensão real:**
  - Selecionar uma carteira inicia a conexão: `POST /wallet-connections` com `walletId`. O mock responde, após uma latência curta, com conexão aprovada ou recusada, conforme o cenário.
  - A interface mostra "Conectando à MetaMask…" com status acessível. Na recusa, mostra "Conexão recusada na carteira" e a ação "Tentar novamente".
  - Nenhuma cotação de confirmação é feita sem conexão ativa.
- **Desconexão:**
  - Um controle de cenário desconecta a carteira no servidor simulado.
  - A desconexão é detectada pela API (por exemplo, `GET /wallet-connections/:id` ou a própria cotação respondendo 409 com código próprio) ao revalidar, ao confirmar e ao recuperar o foco da janela.
  - A interface informa que a carteira foi desconectada, desabilita "Confirmar compra" e oferece reconectar. Não use eventos privados de Socket.IO nesta etapa.
- **Contratos:** defina `WalletConnection` (id, walletId, status, createdAt) e os erros (recusa, carteira de outro usuário com 403, carteira inexistente com 404) em `src/contracts`, com validadores, e documente em `docs/contracts/rest.md`.

## 5. Cotação e revalidação

Implemente `POST /quotes`. Ajuste o contrato: a entrada passa a ser `{ cartId, cartVersion, walletId }`, e a rede vem da carteira no servidor. Atualize `QuoteRequest`, a documentação e qualquer referência a `network` na cotação.

**O servidor:**

- confere a sessão e a titularidade do carrinho e da carteira (403 para carteira de outro usuário);
- confere a conexão ativa da carteira;
- confere a versão do carrinho (409 se estiver desatualizada);
- revalida preços e disponibilidade atuais: conflito de disponibilidade responde 409 com os itens afetados, sem reduzir quantidades;
- **revalida o cupom, inclusive a expiração** (hoje só verificada ao aplicar): cupom expirado sai da cotação com motivo explícito;
- calcula a taxa da rede da carteira com a aritmética de `src/contracts/eth.ts`.

**A cotação** retorna `id`, `version`, `expiresAt` (validade curta e documentada, pelo relógio real, com controle de cenário para expirar), itens, cupom, valores e `requiresConfirmation`.

**Revalidação:**

- Ao clicar em "Confirmar compra", o cliente pede nova cotação para os mesmos carrinho e carteira.
- Se preço, disponibilidade, cupom, taxa ou total mudaram em relação à cotação exibida, **não prossiga**. Mostre o que mudou (valor anterior e atual, item esgotado, cupom removido) em um aviso acessível e exija nova confirmação explícita do usuário ("Revisei, confirmar com os novos valores").
- Cotação expirada é renovada automaticamente. Se os valores mudarem, aplica-se a mesma regra.
- `nft.updated` de um item do checkout dispara nova cotação e o mesmo aviso, sem trocar em silêncio os valores que o usuário está prestes a confirmar.
- Sem mudanças e com conexão ativa, "Confirmar compra" mostra o diálogo de indisponibilidade da criação de pedidos, informando que o carrinho e o rascunho continuam salvos. Nenhum pedido é criado.

**Cenários novos** (somente mocks e testes): recusa da próxima conexão, desconexão da carteira atual, expiração da cotação atual, falha transitória ou atraso na cotação e na conexão. Mudanças de preço e disponibilidade usam o `update` existente.

## 6. Acessibilidade e responsividade

- Verifique 390, 414, 768 e 1440px. Em 768px, documente se usa a página única ou os passos, coerente com o limite de 700px do login, se fizer sentido.
- Grupos de rádio com `fieldset`/`legend`, ou o padrão `radiogroup` com navegação por setas.
- Avisos de conexão, recusa, desconexão e mudanças da cotação são anunciados uma vez, sem repetição.
- O botão fixo do mobile reserva espaço, respeita safe areas e o teclado virtual.
- Sem overflow horizontal com endereços longos, valores ETH longos e zoom.

## 7. Testes e verificação

Preserve as suítes existentes. Adicione testes de integração observando a interface e passando pelos handlers MSW reais:

1. Carrinho → "Conectar e finalizar" → `/checkout` autenticado. Deslogado, vai ao login e volta ao checkout.
2. Carrinho vazio ou com conflito não abre o checkout.
3. Pré-preenchimento a partir da carteira e da conta; trocar de carteira não sobrescreve o que foi digitado.
4. Validação por campo, incluindo endereço e ENS. ENS e indicação são opcionais.
5. `lin_example`, sem carteiras, cadastra uma carteira no checkout; ela vira `primary` e fica selecionada. Endereço inválido e duplicado são recusados pela API.
6. Conexão aprovada, recusada (com nova tentativa) e desconexão detectada antes de confirmar.
7. A taxa muda com a rede da carteira (Ethereum × Polygon) e os valores vêm da API.
8. Revalidação: mudança de preço, esgotamento, cupom expirado e cotação expirada exigem nova confirmação, mostrando o que mudou. Sem mudanças, aparece o diálogo de indisponibilidade dos pedidos.
9. `nft.updated` durante o checkout gera aviso e nova cotação.
10. Mobile: passos com URL, voltar, avançar e refresh; não avança com passo inválido.
11. Expiração da sessão no checkout: login e retorno com o rascunho preservado. Logout ou troca de usuário descartam o rascunho e as carteiras do usuário anterior.
12. Teclado e foco nos grupos de rádio, no cadastro de carteira e nos avisos.

Execute os fluxos principais em Chromium desktop e mobile. Crie as referências visuais do checkout (desktop e mobile, passo da carteira), que o requisito exige. Inspecione-as e compare com os frames antes de aceitar.

Execute tipos, lint, formatação, build, build de integração, testes de integração e E2E. **Não execute o Lighthouse nesta etapa**: haverá uma etapa de desempenho dedicada no fim.

## 8. Documentação e entrega

Atualize README, arquitetura, contratos e cenários em pt-BR. Inclua:

- rota, proteção, pré-condições e passos mobile do checkout;
- regra do rascunho (onde fica, quando sobrevive e quando é descartado);
- carteiras: seed, endpoints, validação, regra de primária e secundária, cadastro no checkout;
- simulação de conexão, recusa e desconexão, e seus cenários;
- contrato da cotação (entrada com `walletId`), validade, revalidação e a regra de nova confirmação;
- revalidação da expiração do cupom;
- decisões e desvios do Figma desta etapa;
- adaptadores de indisponibilidade que permanecem (criação de pedido, edição de carteira, menu "⋮");
- evidências executadas e o que não foi verificado.

Ao concluir, informe arquivos alterados, fluxos entregues, resultados dos testes e eventuais desvios visuais. Não declare o desafio inteiro concluído.

**Pare na revisão validada do checkout. Não avance para criação de pedidos, idempotência, recibo, eventos privados, edição de carteiras, perfil, commit, push ou deploy sem nova autorização.**
