# Próxima etapa: conta do colecionador, carteiras e favoritos

## Objetivo

Com o fluxo de compra completo, implementar a área da conta do colecionador com a infraestrutura REST, Query, MSW e Socket.IO existente:

- **perfil:** dados, avatar e troca de senha, salvos por um único botão;
- **carteiras:** cadastro e edição da principal e da secundária, com "Igual à carteira principal";
- **favoritos** persistidos por usuário, com atualização otimista e reversão em caso de falha (a interação otimista exigida pelo requisito), e a página "Lista de interesse";
- **navegação da conta:** desktop com barra lateral; mobile com o menu "Meu perfil" recolhível;
- **seções fora do escopo** (Atividade, Ofertas, Arquivos baixados, Suporte) como páginas que informam honestamente que não estão disponíveis.

Fora desta etapa: histórico de pedidos, recuperação de senha, login social, exclusão de carteira ou de conta, a etapa final de desempenho e a implantação.

## Ponto de partida e referências

- Repositório: https://github.com/Moharu/frontend-challenge
- Último commit revisado: `fabc1b2` (pedidos e correções).
- Requisitos: `docs/challenge-requirements.md`, em especial "Perfil do colecionador", "Carteiras", favoritos persistidos por usuário, atualização otimista com rollback, validação de formulários com erros da API e persistência após refresh.
- Contratos e decisões existentes: `ARCHITECTURE.md`, `docs/contracts/rest.md` (perfil, carteiras e "Propriedade e significado dos campos"), `docs/session.md`, `docs/checkout.md`, `docs/orders.md` e `src/contracts/{profile,wallets,favorites,session}.ts`.
- Figma: https://www.figma.com/design/Zbw0vAAPU80HoDwKVfAcCR/Frontend-Challenge--Copy-?node-id=0-1
- Implantação: Vercel. Não implantar nesta tarefa.

Inspecione o checkout atual e as instruções aplicáveis antes de editar. Preserve trabalho mais recente; não resete para o commit citado. Reutilize a stack e o lockfile existentes. Não crie repositório remoto, commit, push ou deploy sem autorização separada.

## Consulta ao design

Consulte o Figma em modo somente leitura ou as capturas fornecidas pelo usuário. Não altere o arquivo.

Frames desta etapa: Desktop / Perfil do Colecionador (`9:1238`) e Desktop / Carteiras (`9:1670`). **Não há frames mobile**; adapte a partir do desktop. Para o coração de favoritos, use os ícones já existentes nos cartões e no detalhe.

Observações verificadas nas capturas, a confirmar no arquivo:

- **Barra lateral "Meu perfil"** (comum às duas telas): Dados do perfil, Carteiras, Atividade, Lista de interesse, Ofertas, Arquivos baixados, Suporte e, separado, Sair. O item ativo tem uma barra cobre à esquerda.
- **Perfil ("Perfil do colecionador"):**
  - campos Nome de exibição, Nome de usuário, E-mail, Nome ENS (seletor `.eth` mais campo), Apelido da carteira e Avatar (círculo, "Alterar", "Remover");
  - seção "Alterar senha": Senha atual, Nova senha e Confirmar nova senha, cada uma com mostrar/ocultar;
  - **um único botão "Salvar"**.
- **Carteiras:**
  - "Carteira principal", com a descrição "Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados." e o link "Adicionar";
  - formulário com Nome de exibição, Apelido da carteira, Rede, Nome do perfil, Endereço da carteira, "ENS ou carteira secundária (opcional)", Tipo de carteira, Código de indicação, E-mail e Nome ENS, e o botão "Salvar carteira";
  - "Carteira secundária", com o estado vazio "Você ainda não adicionou uma carteira secundária.", a opção "Igual à carteira principal" e "Adicionar".

### Inconsistências e decisões de design

- **Asteriscos.** Valem as regras do contrato, não os asteriscos do Figma. Remova o asterisco dos campos que o contrato trata como opcionais:
  - no perfil, Nome de exibição, Nome ENS e Apelido da carteira (somente username e e-mail são obrigatórios);
  - nas carteiras, Nome de exibição, Nome do perfil, Código de indicação, E-mail e Nome ENS.

  Endereço, rede, tipo de carteira e apelido da carteira continuam obrigatórios na carteira, como no cadastro feito no checkout. Documente.
- **Cabeçalho.** Os frames mostram "Entrar"; use o cabeçalho autenticado já implementado.
- **"Adicionar" na carteira principal.** Só aparece quando o usuário ainda não tem carteira principal. Com uma principal, o formulário edita a existente.
- **Mobile.** No topo da área da conta, um botão de disclosure "Meu perfil · <seção atual> ▾" (`aria-expanded`) expande a lista de seções inline e a recolhe depois da escolha. Não use drawer nem um segundo ícone de menu, que concorreria com "Minha conta" da navegação inferior. Formulários em coluna única. Documente.

## 1. Rotas e navegação da conta

- Área da conta protegida por `requireSession` e `SessionCheckError`, com URLs reais, acesso direto, refresh e histórico. Sugestão:
  - `/account` redireciona para `/account/profile`;
  - `/account/profile`, `/account/wallets` e `/account/favorites` (Lista de interesse);
  - `/account/activity`, `/account/offers`, `/account/downloads` e `/account/support`.
- Um layout comum com a barra lateral (desktop) e o disclosure (mobile), com `aria-current="page"` no item ativo.
- "Sair" usa o logout existente.
- Inclua as novas rotas na lista de destinos válidos de `safeRedirect`, para que expiração e login devolvam o usuário à seção em que estava.
- **Atualize os pontos que hoje usam indisponibilidade:**
  - "Meu perfil" e "Carteiras" do menu da conta no cabeçalho e da folha "Minha conta" no mobile passam a levar às novas rotas;
  - no checkout, o menu "⋮" das carteiras passa a oferecer "Editar carteira", levando a `/account/wallets`;
  - o coração dos cartões e do detalhe passa a favoritar de verdade (seção 5);
  - o ícone de favoritos da navegação inferior mobile leva a `/account/favorites`.

## 2. Seções não implementadas como páginas

Atividade, Ofertas, Arquivos baixados e Suporte navegam para páginas reais dentro do layout da conta, em vez do diálogo de indisponibilidade. Assim a navegação da conta continua visível e com o item marcado. Decisão do usuário.

- O conteúdo diz claramente que a seção não está disponível nesta versão (por exemplo "Esta seção não está disponível nesta versão.") e oferece um link para "Dados do perfil".
- **Nenhum conteúdo fictício:** sem atividades, ofertas ou arquivos de exemplo, e sem listas vazias que sugiram uma funcionalidade pronta e apenas sem dados.
- O diálogo de indisponibilidade continua valendo para ações pontuais fora da barra lateral.
- Documente a escolha.

## 3. Perfil

Endpoints previstos: `GET /profile`, `PATCH /profile`, `PUT /profile/avatar` e `PUT /profile/password`, conforme `src/contracts/profile.ts`.

**Servidor simulado:**

- Perfil persistido por usuário, criado no cadastro e na seed.
- **`PATCH /profile`:** exige `version` e responde 409 para versão desatualizada e para username ou e-mail em uso por outra conta. Valida com as mesmas regras do cadastro (username e e-mail) e do checkout (ENS), com validadores compartilhados nos contratos. Omitir um campo preserva o valor; `null` limpa apenas os anuláveis; username e e-mail não aceitam `null`.
- **`PUT /profile/avatar`:** exige `version`. `dataUrl` `null` remove o avatar. Aceite somente `data:image/webp`, `data:image/jpeg` ou `data:image/png`, com tamanho máximo documentado (por exemplo 150 KB depois de decodificado), e responda 400 com `fields.avatar` fora disso.
- **`PUT /profile/password`:** verifica a senha atual com o hash existente (400 com `fields.currentPassword` se estiver errada) e aplica as regras de senha do cadastro à nova senha. Grava o novo hash com sal novo, nunca a senha em claro. A sessão atual continua válida; decida e documente se as demais sessões do usuário são revogadas.
- Mudanças de username, e-mail ou nome de exibição atualizam a identidade da sessão (`GET /session`), e o cabeçalho reflete o novo nome sem novo login.
- Alterar o perfil **não** altera carteiras nem pedidos existentes, conforme "Propriedade e significado dos campos" em `docs/contracts/rest.md`.

**Tela, com um único "Salvar":**

- **"Alterar"** abre o seletor de arquivo e mostra uma prévia local; **"Remover"** limpa a prévia e marca a remoção. Nenhum dos dois salva nada sozinho.
- **Redimensione no navegador** antes de enviar: recorte quadrado centralizado, 256×256 px, reexportado em WebP (ou JPEG como fallback), respeitando o limite do servidor. Recuse no cliente tipos não suportados e arquivos acima de um limite de origem documentado (por exemplo 5 MB), com erro acessível no campo.
- **"Salvar"** valida tudo no cliente e envia apenas o que mudou, nesta ordem: dados do perfil, avatar (com a `version` devolvida pelo passo anterior) e senha, se os campos de senha foram preenchidos. A confirmação da nova senha é validada só no cliente e não trafega.
- **Falha parcial:** se uma parte falhar (por exemplo, senha atual incorreta), as partes que tiveram sucesso continuam salvas e são indicadas como salvas. A parte que falhou mantém o que foi digitado e mostra o erro no campo. Nunca apresente sucesso geral quando algo falhou. Um resumo acessível informa o resultado de cada parte.
- Depois do sucesso, os campos de senha são limpos e os dados exibidos vêm da resposta da API. Tudo permanece após refresh.
- O avatar salvo aparece também no menu da conta do cabeçalho, se houver espaço na composição.
- Labels associados, erros por campo vinculados, foco no primeiro campo inválido e regras de username e senha no mesmo padrão já adotado.

## 4. Carteiras

Implemente `PATCH /wallets/:id` conforme o contrato (exige `version`, 409 para versão desatualizada). `GET` e `POST` já existem.

- **Limite:** no máximo uma carteira principal e uma secundária por usuário, como no frame e no requisito ("principal e secundária"). `POST /wallets` com as duas já cadastradas responde 409 com mensagem clara.
  - No checkout, "Cadastrar nova carteira" fica indisponível nesse caso, com a explicação e um link para editar as carteiras.
  - Se o estado atual permitir mais de uma secundária, defina e documente como normalizar.
- **Formulários de edição** da principal e da secundária com os campos do frame. Endereço, rede e tipo validados como no cadastro (validadores compartilhados; endereço único por usuário). Erros da API nos campos.
- **"Adicionar"** da secundária abre o formulário vazio. **"Igual à carteira principal"** é uma ação de preenchimento, não um vínculo persistido, conforme o contrato:
  - copia para o formulário da secundária os campos descritivos da principal (nome de exibição, nome do perfil, e-mail, nome ENS, código de indicação, ENS ou carteira secundária);
  - **não** copia o endereço, porque ele precisa ser único;
  - o usuário ainda revisa e salva.
- **Mudança de endereço, rede ou tipo** em uma carteira com conexão ativa encerra essa conexão no servidor simulado. O checkout passa a mostrar a desconexão já implementada e pede nova cotação.
- Pedidos existentes mantêm o snapshot da carteira da criação. Teste que editar a carteira não altera um recibo.
- Cada formulário tem seu próprio botão "Salvar carteira", como no frame.

## 5. Favoritos com atualização otimista

Endpoints previstos: `GET /favorites`, `POST /favorites` (inclusão idempotente) e `DELETE /favorites/:nftId`, conforme `src/contracts/favorites.ts`.

- **Servidor:** favoritos persistidos por usuário no estado simulado. Respondem 404 para NFT inexistente e não vazam entre usuários. Inclua um cenário de falha de uso único para as escritas de favoritos (HTTP e rede), para testar a reversão.
- **Coração nos cartões do catálogo, nos relacionados, nas recomendações e no detalhe**, com `aria-pressed` e nome acessível ("Favoritar Emerald Ape #042" / "Remover Emerald Ape #042 dos favoritos").
- **Atualização otimista**, nesta ordem:
  1. cancelar as consultas de favoritos em andamento;
  2. guardar o estado anterior;
  3. atualizar o cache imediatamente;
  4. enviar a requisição;
  5. em caso de falha, **reverter** para o estado anterior e anunciar o erro de forma acessível;
  6. no fim, reconciliar com a API (invalidação).

  Cliques repetidos rápidos no mesmo coração terminam no estado da última intenção, sem oscilar nem deixar o cache divergente da API.
- **Deslogado:** o coração leva ao login com retorno à mesma página. Depois do login o favorito não é aplicado automaticamente; o usuário clica de novo. Documente.
- **Isolamento:** a chave Query no escopo de usuário e geração, limpa no logout, na expiração e na troca de usuário, como carrinho e carteiras.
- **"Lista de interesse"** (`/account/favorites`):
  - lista os NFTs favoritados com os mesmos cartões do catálogo, mostrando preço e disponibilidade atuais (atualizados por `nft.updated`);
  - remover um favorito na lista usa a mesma atualização otimista;
  - estado vazio honesto, com link para o catálogo;
  - skeleton com shimmer, erro com nova tentativa.

## 6. Acessibilidade e responsividade

- Verifique 390, 414, 768 e 1440px. Em 768px, documente se a conta usa a barra lateral ou o disclosure.
- O disclosure mobile informa o estado aberto ou fechado e devolve o foco ao botão depois da escolha.
- Os anúncios de salvar perfil, salvar carteira, favoritar e reverter são feitos uma vez, em região de status.
- Prévia do avatar com texto alternativo coerente ("Prévia do novo avatar" / "Avatar de ada_example").
- Sem overflow horizontal com endereços, ENS e e-mails longos.

## 7. Testes e verificação

Preserve as suítes existentes. Adicione testes de integração observando a interface e passando pelos handlers MSW reais:

1. Navegação da conta: cada item leva à sua rota com o item marcado; as quatro seções não implementadas mostram a página honesta; o disclosure mobile abre, navega e fecha; acesso deslogado vai ao login e volta à seção.
2. Perfil: editar dados, salvar, refresh mantém; o cabeçalho reflete o novo nome; username ou e-mail em uso responde 409 no campo; versão desatualizada responde 409.
3. Avatar: escolher imagem, prévia, salvar, refresh mantém e a imagem enviada tem 256×256; remover e salvar; tipo ou tamanho inválido recusado no cliente e na API.
4. Senha: senha atual errada mostra erro no campo; troca válida permite entrar com a nova senha e não com a antiga; nenhuma senha em claro no estado simulado.
5. Falha parcial: dados salvos e senha recusada no mesmo "Salvar"; dados indicados como salvos e senha com erro.
6. Carteiras: editar a principal, salvar, refresh mantém; adicionar secundária com "Igual à carteira principal" (endereço não copiado); limite de duas carteiras; endereço duplicado ou inválido recusado pela API.
7. Editar o endereço de uma carteira conectada encerra a conexão, e o checkout mostra a desconexão; editar a carteira não altera um recibo existente.
8. Favoritos: favoritar e desfavoritar no cartão e no detalhe; refresh mantém; a lista mostra os favoritos.
9. Reversão otimista: falha HTTP e de rede revertem o coração e anunciam o erro; cliques repetidos rápidos terminam coerentes com a API.
10. Isolamento: o usuário B não vê favoritos, perfil nem carteiras de A, nem por um instante de cache.
11. Deslogado: o coração leva ao login e volta à página.
12. `nft.updated` reflete preço e disponibilidade na Lista de interesse.
13. Teclado e foco: barra lateral, disclosure, avatar, mostrar/ocultar senha e corações.

Execute os fluxos principais em Chromium desktop e mobile. Referências visuais de perfil e carteiras são opcionais; se criadas, inspecione-as e compare com os frames antes de aceitar.

Execute tipos, lint (com `check:bom`), formatação, build, build de integração, testes de integração e E2E, com o limite de workers configurado. **Não execute o Lighthouse nesta etapa.**

**Fique atento a erros de infraestrutura** ("Target crashed", navegador fechado, timeout do servidor de pré-visualização, falta de memória, processo encerrado) e a falhas que só aparecem na suíte completa. Registre cada ocorrência em `docs/account-verification.md` com teste, condição e resultado ao repetir, e investigue a causa em vez de usar retentativas. Ao final, confirme que não ficaram navegadores nem servidores de pré-visualização órfãos.

## 8. Documentação e entrega

Atualize README, arquitetura, contratos e cenários em pt-BR. Inclua:

- rotas da conta, navegação desktop e mobile, e as páginas de seções não implementadas;
- perfil: regras de campos, versão, avatar (limites, redimensionamento, formato), troca de senha, política para outras sessões e a regra de falha parcial do "Salvar";
- carteiras: edição, limite de principal e secundária, "Igual à carteira principal", efeito da edição em conexões e a preservação dos snapshots dos pedidos;
- favoritos: contrato, atualização otimista com reversão, comportamento deslogado e isolamento;
- decisões e desvios do Figma desta etapa;
- adaptadores de indisponibilidade que permanecem;
- evidências executadas e o que não foi verificado.

Ao concluir, informe arquivos alterados, fluxos entregues, resultados dos testes e eventuais desvios visuais. Não declare o desafio inteiro concluído.

**Pare após a conta, as carteiras e os favoritos. Não avance para desempenho, revisão visual final, commit, push ou deploy sem nova autorização.**
