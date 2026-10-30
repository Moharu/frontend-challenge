# Cadastro, login e sessão

Etapa guiada por `docs/handoffs/coding-agent-session-draft-pt-br.md`. Implementa cadastro, login, logout, recuperação e expiração de sessão, mesclagem do carrinho de visitante e retorno ao fluxo. Checkout, cotação, pedidos, favoritos persistidos, perfil e carteiras continuam fora do escopo.

## Credenciais fictícias e redefinição

| Conta         | E-mail             | Senha          | Nome exibido |
| ------------- | ------------------ | -------------- | ------------ |
| `ada_example` | `ada@example.test` | `AdaKurio2026` | Ada Example  |
| `lin_example` | `lin@example.test` | `LinKurio2026` | Lin Example  |

São credenciais de demonstração, sem valor fora desta simulação. A seed guarda apenas o sal e o hash (PBKDF2-SHA256, 100.000 iterações, Web Crypto), pré-calculados com `scripts/hash-password.mjs`. Contas criadas no cadastro recebem hash no momento da criação; nenhuma senha em claro é armazenada no retrato simulado, no localStorage do cliente ou em respostas da API.

Para redefinir o estado, use "Limpar dados do site" e recarregue. A lista completa de chaves (localStorage com o estado simulado e os tokens do cliente; sessionStorage com o rascunho do checkout e a tentativa de pedido) está em [README › Cenários: seleção e reset](../README.md#cenários-seleção-e-reset). Um token de cliente que o servidor não conhece mais é tratado como sessão inválida (silenciosamente na verificação inicial) ou como carrinho de visitante perdido, conforme o caso.

## Rotas e telas

- `/login` e `/signup` aceitam `redirect` (destino de retorno). No desktop, o diálogo do Figma aparece sobre a página; no mobile (≤700px), o mesmo diálogo ocupa a tela com um botão "Voltar".
- **A página de fundo é preservada.** Aberto dentro do app ("Entrar", "Minha conta", "Conectar e finalizar", expiração da sessão), o diálogo usa o mascaramento de rota do TanStack Router (`authLink` em `src/lib/redirect.ts`): o roteador continua na página atual, marcada no estado do histórico (`auth` e `authTarget`), enquanto a barra de endereço mostra `/login?redirect=…` ou `/signup?redirect=…`. A página não é remontada: filtros, paginação, rolagem e rascunhos ficam como estavam. Trocar entre "Entrar" e "Criar conta" substitui a entrada do histórico; fechar volta uma entrada; um login bem-sucedido substitui a entrada pela página, então "voltar" não reabre o login. Abrir `/login` diretamente (ou recarregar a URL mascarada) usa a rota real, com o diálogo sobre a página inicial, já que não há página viva a preservar. **Carregamento do diálogo:** o código do diálogo fica num chunk próprio, pré-carregado depois do evento `load` da página (sem competir com o LCP) e de imediato quando a página é carregada já com o diálogo aberto. Depois de carregado, o componente é renderizado diretamente, sem `lazy`/Suspense: o React 19 mantém um fallback de Suspense revelado por cerca de 300 ms, o que deixava a primeira abertura visivelmente mais lenta (≈310 ms → ≈14 ms). No mobile, uma página recarregada com o diálogo aberto recebe a classe `auth-restoring` no `<html>` desde a inicialização, cobrindo a tela até o diálogo de tela cheia montar, para a página de fundo não aparecer antes dele.

**Recarregar com o diálogo aberto:** o roteador reconstrói a página de fundo a partir do estado do histórico, no topo, como em qualquer recarga. Fechar então substitui a entrada (sem voltar à entrada anterior, de outra carga da página) e não rola até o hash; a restauração de rolagem do navegador fica em `manual` até o diálogo fechar, senão ela aplicaria a posição antiga assim que a página deixasse de estar travada pelo diálogo. O destino é guardado no estado do histórico porque, numa localização mascarada, o `href`/`hash` do roteador perdem o hash (`#catalogo`).

- O diálogo tem foco inicial no primeiro campo, foco preso, Escape fecha e o foco volta ao elemento que o abriu. Como o fechamento acontece pela navegação (o Radix não vê um fechamento), o próprio diálogo guarda o elemento de origem e o refoca depois; a troca entre "Entrar"/"Criar conta" mantém a origem.
- Usuário autenticado que acessa `/login` ou `/signup` vai direto ao destino (`redirectAuthenticated`). `requireSession` (`src/lib/route-guards.ts`) protege as rotas privadas `/checkout`, `/orders/$orderId` e `/account/*`: espera a sessão guardada, manda visitantes ao login com retorno à rota e mostra um estado de nova tentativa quando a sessão não pôde ser confirmada.
- Cabeçalho desktop: "Entrar" leva a `/login` com a página atual como destino. Autenticado, mostra o nome de exibição (ou o username, se nulo) num menu com "Meu perfil" (`/account/profile`), "Carteiras" (`/account/wallets`), "Lista de interesse" (`/account/favorites`) e "Sair". Mobile: "Minha conta" abre o login ou uma folha com a identidade, "Meu perfil", "Carteiras" e "Sair". Enquanto uma sessão guardada é verificada, o espaço da conta fica neutro (sem piscar "Entrar").
- Formulários: labels associados (visualmente ocultos para manter a composição só com placeholders), regras conhecidas antes de qualquer erro (visíveis no mobile; no desktop, com o campo em uso), erros de campo em `aria-describedby`, foco no primeiro campo inválido, resumo `role="alert"` para erros gerais e valores digitados preservados após falha. Confirmação de senha é validada só no cliente e não trafega.
- "Esqueceu a senha?" e "Continuar com Google/Facebook" abrem o aviso de indisponibilidade (diálogo aninhado; Escape fecha só o aviso).

## Política de sessão

- **Transporte:** a API simulada emite um token opaco (`session-<uuid>`). O cliente o guarda em localStorage (com fallback em memória) para sobreviver ao refresh e o envia em `Authorization: Bearer` pelo Axios. **Limitação:** um token acessível ao JavaScript é uma simplificação da simulação; em produção seria um cookie `HttpOnly`, `Secure` e `SameSite` (registrado em `ARCHITECTURE.md`).
- **Validade:** 7 dias pelo relógio real (`sessionDurationMs`). A ponte de testes pode expirar ou revogar uma sessão (`expireSession`, `revokeSession`); não existe endpoint público para isso.
- **Geração:** contador global do servidor, avançado em cada login, cadastro e logout. A sessão expõe `generation`; caches privados e assinaturas de tempo real são indexados por usuário e geração.
- **Verificação no carregamento:** `GET /session` roda em paralelo com a renderização (não bloqueia a página pública). 401 limpa o token silenciosamente; falhas transitórias mantêm o estado "verificando" e tentam de novo em `focus`/`online`.
- **Expiração durante o uso:** uma resposta 401 `SESSION_INVALID` a uma requisição feita **com o token atual** encerra a sessão local, avisa "Sua sessão expirou. Entre novamente para continuar." e leva ao login com a página atual (search e hash) como destino. Respostas tardias de um token anterior são ignoradas. O contexto público continua utilizável.
- **Logout:** a identidade local é limpa primeiro (nunca depende da rede); depois `POST /session/logout` revoga o token no servidor. Um token revogado nunca volta a funcionar.

## Retorno ao fluxo e redirecionamento aberto

O destino trafega no search param `redirect`, validado por `safeRedirect` (`src/lib/redirect.ts`). Só são aceitos caminhos internos começando com uma única `/`, sem `\` nem caracteres de controle, de rotas conhecidas (`/`, `/cart`, `/nfts/:id`), preservando search e hash. Qualquer outro valor (`https://…`, `//…`, `javascript:`, `/\…`, rotas desconhecidas, `/login`) vira `/`. "Conectar e finalizar" no carrinho agora leva ao login com retorno ao carrinho.

## Mesclagem do carrinho no login

Login e cadastro enviam o `X-Visitor-Token` atual. O servidor mescla o carrinho do visitante no carrinho da conta **uma única vez** e consome o token, então repetir o login com o mesmo token não duplica nada (`merge: null`).

- Mesma edição: as quantidades somam, sem corte. O excesso aparece como o conflito normal da linha ("Disponível no máximo N."), nunca é reduzido em silêncio.
- Edição nova: a linha é acrescentada.
- Cupom: o do visitante prevalece quando ambos existem (intenção mais recente); sem cupom de visitante, o da conta é mantido.
- A resposta traz `addedLines`, `mergedLines`, `conflictLines` e o cupom resultante; a interface anuncia o resultado (por exemplo, "2 linhas do carrinho de visitante foram juntadas ao seu carrinho. 1 linha precisa de ajuste no carrinho.").
- Depois do login o cliente não tem mais token de visitante; o logout volta a um carrinho de visitante vazio.

## Isolamento por usuário e geração

- A chave da consulta do carrinho inclui o escopo: `{ kind: "visitor", token }` ou `{ kind: "user", userId, generation }`; enquanto uma sessão guardada é verificada, o escopo é nulo e nada é lido.
- Em login, logout, expiração e troca de usuário, a nova identidade é publicada primeiro (re-renderizações e novas requisições já a usam), depois as requisições privadas em andamento são canceladas e as entradas de outros escopos removidas. Uma resposta tardia chega a uma chave removida e é descartada. As respostas de mutation carregam o escopo em que foram pedidas.
- O tempo real descarta ouvintes privados na troca de identidade e ignora envelopes de outro usuário ou geração. O evento privado `order.updated` só é entregue às conexões do dono, com a sessão conferida de novo a cada entrega ([eventos](contracts/events.md)).

## Erro de visitante × erro de sessão

Token de visitante desconhecido responde 401 **`VISITOR_INVALID`** e significa somente "carrinho de visitante perdido": o token é descartado e o aviso é "Seu carrinho anterior não está mais disponível." (numa mutation, a ação não é aplicada em silêncio a um carrinho novo). **`SESSION_INVALID`** é exclusivo de sessão autenticada e é o único que dispara o fluxo de expiração.

## Desvios do Figma e indisponibilidades

- **Sem saída no mobile:** as telas mobile não têm voltar nem fechar; foi acrescentado "Voltar" no padrão do cabeçalho mobile do carrinho, levando ao destino de retorno ou ao catálogo.
- **Modal sem fundo escurecido:** mantida a composição desktop sem escurecimento forte, com um fundo sutil para indicar o modal; o conteúdo atrás fica inerte para teclado e leitores de tela (`aria-modal`, foco preso).
- **Texto do botão de cadastro:** "Criar conta" no desktop e "Criar perfil" no mobile (com o título "Criar perfil de colecionador"), mantidos como em cada frame por exigência do usuário; as duas variantes ficam no mesmo botão (`desktop-only`/`mobile-only`), e o formulário tem o mesmo nome acessível ("Criar conta") nas duas composições.
- **Rótulos:** cada campo tem `<label>` associado, visualmente oculto, para preservar a composição do Figma só com placeholder sem deixar o campo sem nome acessível.
- **Placeholder do e-mail no login:** "contato@email.com" virou "Digite seu e-mail", porque o exemplo parecia um valor já preenchido.
- **Alinhamento:** o placeholder "Nome de usuário", centralizado no cadastro mobile do Figma, foi alinhado à esquerda como os demais campos, por consistência de leitura.
- **Mostrar/ocultar senha:** ícone de olho como no Figma (riscado enquanto a senha está oculta), com o nome acessível "Mostrar senha". A pedido do usuário, também em "Confirmar senha", nas duas composições (no desktop o Figma só o mostra em "Senha").
- **Diálogo desktop (Figma):** abas e descrição centralizadas, campos estreitos, divisória "Ou continue com" de borda a borda e botões sociais discretos com os ícones do Google e do Facebook.
- **Regras dos campos no cadastro desktop:** o Figma não as mostra. Continuam na descrição acessível de cada campo e aparecem na tela quando o campo está em uso ou inválido.
- **Regras de username e senha:** o layout não as mostra. No mobile ficam visíveis abaixo dos campos antes de qualquer erro; no desktop aparecem com o campo em uso ou inválido (item acima). Em ambos fazem parte da descrição acessível do campo, para que as exigências sejam conhecidas antes do envio.
- **Composição em 768px:** o limite é 700px; até 700px o diálogo ocupa a tela inteira (composição mobile), acima disso é o modal desktop. Em 768px, portanto, aparece o modal.
- O botão "Entrar" do cabeçalho passou a usar o ícone do Figma (`home-Logout.svg`); as referências visuais desktop de início, detalhe e carrinho foram atualizadas por causa disso.
- Continuam com aviso de indisponibilidade, fora do escopo: login social e recuperação de senha. Perfil, carteiras, favoritos, checkout e pedidos estão implementados ([conta](account.md), [checkout](checkout.md), [pedidos](orders.md)).

## Limitações

- **Login ou logout em outra aba não é percebido.** Cada aba mantém a própria identidade em memória; não há sincronização entre abas. Exemplo: depois de entrar em outra aba, a aba antiga ainda usa o token de visitante já consumido pela mesclagem e mostra "Seu carrinho anterior não está mais disponível", embora os itens estejam na conta. Recarregar a aba antiga resolve.
