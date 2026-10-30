# Conta do colecionador, carteiras e favoritos

Etapa guiada por `docs/handoffs/coding-agent-account-draft-pt-br.md`. Implementa a área da conta (perfil com avatar e troca de senha, carteiras principal e secundária, "Lista de interesse") e os favoritos com atualização otimista e reversão. Fora desta etapa: histórico de pedidos, recuperação de senha, login social, exclusão de carteira ou de conta. Contratos em [REST](contracts/rest.md#conta-implementada-perfil-carteiras-e-favoritos).

## Rotas e navegação

- `/account` redireciona para `/account/profile`. Seções: `/account/profile` (Dados do perfil), `/account/wallets` (Carteiras), `/account/favorites` (Lista de interesse) e `/account/activity`, `/account/offers`, `/account/downloads` e `/account/support`.
- Um layout comum, protegido por `requireSession` e `SessionCheckError`: acesso direto, refresh e histórico funcionam; deslogado vai ao login e volta à seção (as rotas estão na lista de `safeRedirect`). O item ativo tem `aria-current="page"` e a barra cobre à esquerda.
- **Desktop:** a barra lateral "Meu perfil" do frame, com "Sair" (logout existente) separado. **Mobile (até 700px, o limite do login):** no topo, o botão "Meu perfil · <seção> ▾" (`aria-expanded`) abre a lista sobre a seção (sem empurrar o conteúdo, orientação do usuário) e a recolhe depois da escolha, com Escape ou com um toque fora, devolvendo o foco ao botão na escolha e no Escape. Sem drawer e sem segundo ícone de menu, para não concorrer com "Minha conta" da navegação inferior. **Em 768px usa-se a barra lateral** (mais estreita entre 701 e 1000px, com formulários em coluna única).
- **Sem rodapé nas páginas da conta** (orientação do usuário): só o cabeçalho e a área da conta.
- **Rodapé:** "Meu perfil", "Atividade" e "Lista de interesse" da coluna "Meu perfil" levam às rotas da conta (deslogado, ao login e de volta); os demais itens continuam com o aviso de indisponibilidade.
- Pontos que eram indisponibilidade: "Meu perfil", "Carteiras" e "Lista de interesse" no menu da conta do cabeçalho; "Meu perfil" e "Carteiras" na folha "Minha conta" do mobile; o coração da navegação inferior leva à Lista de interesse; o "⋮" das carteiras no checkout oferece "Editar carteira".

## Seções não implementadas como páginas

Atividade, Ofertas, Arquivos baixados e Suporte (decisão do usuário) são páginas reais dentro do layout, com o item marcado, que dizem "Esta seção não está disponível nesta versão." e oferecem "Ir para Dados do perfil". Nenhum conteúdo fictício nem lista vazia que sugira funcionalidade pronta. O diálogo de indisponibilidade continua para ações pontuais fora da barra lateral.

## Perfil

- **Campos:** Nome de exibição, Nome de usuário\*, E-mail\*, Nome ENS (seletor `.eth` mais o nome; o valor guardado é o nome completo, por exemplo `ada.eth`), Apelido da carteira e Avatar. Regras compartilhadas em `profileErrors` (cliente e servidor): username e e-mail como no cadastro, ENS `.eth` válido, textos até 60 caracteres.
- **Versão:** toda escrita envia a `version` do perfil; versão antiga é 409 e nada é sobrescrito em silêncio.
- **Avatar:** "Alterar" abre o seletor de arquivo e mostra uma prévia local ("Prévia do novo avatar"); "Remover" limpa a prévia e marca a remoção. Nenhum dos dois salva sozinho. No navegador (`src/lib/avatar.ts`): só WebP, JPEG ou PNG de origem até **5 MB**; recorte quadrado centralizado, **256×256**, reexportado em **WebP** (JPEG onde o navegador não codifica WebP), reduzindo a qualidade até caber no limite do servidor (**150 KB** decodificado). O servidor recusa outros tipos e tamanhos com `fields.avatar`.
- **Senha:** Senha atual, Nova senha e Confirmar nova senha, cada uma com mostrar/ocultar (o olho do frame, `aria-pressed`). A confirmação é validada só no cliente e não trafega. A senha atual é verificada pelo hash; a nova recebe hash com sal novo. **Política para outras sessões:** a sessão que trocou a senha continua válida; as demais sessões do usuário são revogadas.
- **Um único "Salvar":** valida tudo no cliente e envia só o que mudou, nesta ordem: dados do perfil, avatar (com a `version` devolvida pelo passo anterior) e senha (se os campos foram preenchidos).
- **Identidade de quem salvou:** os três passos são enviados com a identidade (token e geração) capturada ao pressionar "Salvar". Se a sessão muda no meio (logout, expiração, troca de usuário), os passos restantes não são enviados: nada chega à outra conta.
- **Falha parcial:** cada parte é independente. O que teve sucesso fica salvo e é indicado como salvo; a parte que falhou mantém o que foi digitado e mostra o erro no campo, com foco no primeiro campo inválido. Se os dados falham por rede ou 5xx (sem erros por campo), os campos de dados também mantêm o que foi digitado, mesmo que o avatar seja salvo. Um resumo em região de status informa o resultado de cada parte ("Algumas alterações foram salvas; revise o que falhou."), nunca sucesso geral quando algo falhou.
- Depois do sucesso, os campos de senha são limpos e os valores exibidos vêm da resposta da API. A identidade da sessão é atualizada, e o cabeçalho mostra o novo nome sem novo login.

## Carteiras

- **Limite:** no máximo uma principal e uma secundária (o requisito e o frame). `POST /wallets` com as duas cadastradas é 409. No checkout, "Cadastrar nova carteira" (inclusive ao escolher um provedor sem carteira) mostra a explicação e "Editar carteiras" quando o limite foi atingido. Retratos anteriores ao limite restauram a seed (`schemaVersion` 7), o que normaliza usuários com mais de uma secundária.
- **Formulários:** um por carteira, com os campos do frame e o próprio "Salvar carteira". Endereço, rede e tipo validados como no cadastro (validadores compartilhados, endereço único por usuário sem diferenciar maiúsculas); os descritivos também (e-mail, código de indicação, ENS, ENS ou carteira secundária). Erros da API aparecem nos campos.
- **"Adicionar":** na principal, só aparece quando o usuário não tem principal; com uma principal, o formulário edita a existente. Na secundária, abre o formulário vazio (só existe secundária depois de uma principal).
- **"Igual à carteira principal":** ação de preenchimento, não vínculo persistido. Copia os campos descritivos da principal (nome de exibição, nome do perfil, e-mail, nome ENS, código de indicação, ENS ou carteira secundária) para o formulário da secundária; **não** copia endereço, rede nem tipo. O usuário revisa e salva.
- **Edição e conexão:** mudar endereço, rede ou tipo de uma carteira conectada encerra a conexão no servidor simulado; o checkout mostra a desconexão já implementada e pede nova cotação. Pedidos mantêm o snapshot da carteira da criação (testado com um recibo existente).

## Favoritos

- **Coração** nos cartões do catálogo, nos relacionados e no detalhe (os cartões são os mesmos em todas as listas), com `aria-pressed` e nome acessível "Favoritar Emerald Ape #042" / "Remover Emerald Ape #042 dos favoritos". O ícone é o coração do Figma (contorno), preenchido quando favoritado.
- **Atualização otimista** (`toggleFavorite` em `src/data/account/hooks.ts`): cancela as consultas de favoritos em andamento, guarda o estado confirmado pelo servidor, atualiza o cache na hora, envia a requisição, reverte em caso de falha (anunciando o erro) e, no fim, reconcilia com a API (invalidação).
- **Identidade do clique:** cada requisição da fila vai com a identidade capturada no clique; quando a sessão muda (logout, expiração, troca de usuário), o trabalho enfileirado para sem enviar nada com a sessão nova. Carteiras seguem o mesmo critério (uma requisição imediata, com a identidade capturada); o carrinho já envia cada requisição com a identidade de quem a iniciou; checkout e pedidos fazem requisições imediatas, e a tentativa guardada do pedido é descartada no logout e na troca de usuário ([pedidos](orders.md)).
- **Cliques repetidos rápidos:** as requisições de um mesmo NFT saem uma de cada vez e só a última intenção é enviada; o estado final é o da última intenção, sem oscilar nem divergir da API. Um único anúncio quando os cliques terminam ("adicionado aos favoritos" / "removido dos favoritos"), nenhum se o estado final é o inicial.
- **Deslogado:** o coração leva ao login com retorno à mesma página. Depois do login o favorito **não** é aplicado automaticamente; o usuário clica de novo (evita aplicar uma intenção antiga em outra conta).
- **Isolamento:** `['favorites', escopo]` e `['profile', escopo]` usam o escopo de usuário e geração do carrinho e das carteiras, e são limpos no logout, na expiração e na troca de usuário.
- **Lista de interesse:** os favoritos com os cartões do catálogo, com preço e disponibilidade atuais (consultas de detalhe, atualizadas por `nft.updated`); remover na lista usa a mesma atualização otimista; estado vazio com link para o catálogo; skeleton e erro com nova tentativa.

## Decisões e desvios do Figma

- **Asteriscos pelo contrato:** no perfil, só Nome de usuário e E-mail; nas carteiras, Apelido da carteira, Rede, Endereço e Tipo. Saem do frame os asteriscos de Nome de exibição, Nome ENS e Apelido da carteira (perfil) e de Nome de exibição, Nome do perfil, Código de indicação, E-mail e Nome ENS (carteiras).
- **Cabeçalho autenticado** em vez do "Entrar" dos frames. O item ativo do cabeçalho segue a regra existente (Mercado fora do início), não o "Início" do frame.
- **Ícones da barra lateral:** o arquivo não exportou esses ícones; são SVGs de contorno no mesmo estilo.
- **"Igual à carteira principal"** aparece como o círculo do frame, mas é um botão de ação (não um estado guardado).
- **Avatar no cabeçalho:** não incluído; o botão da conta do cabeçalho mantém só o nome, sem espaço na composição atual.
- **Mobile:** não há frames; formulários em coluna única e o disclosure descrito acima.

## Indisponibilidades que permanecem

Histórico de pedidos (Atividade), Ofertas, Arquivos baixados, Suporte, recuperação de senha, login social, exclusão de carteira ou de conta, "Ver no Etherscan", Criadores, Aprenda e a ação central da navegação mobile.
