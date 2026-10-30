# Verificação da conta

Evidências executadas em 2026-10-30 sobre a árvore de trabalho da etapa da conta (sem commit), partindo de `fabc1b2`. Ambiente: WSL2, Node 24.22.0, npm 11.19.1, Chromium headless do Playwright, 2 workers.

## Verificações automatizadas

| Comando                     | Resultado                                                                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`         | aprovado (dentro de `npm run build`)                                                                                                            |
| `npm run lint`              | aprovado, com `check:bom`                                                                                                                       |
| `npm run format:check`      | aprovado                                                                                                                                        |
| `npm run build`             | aprovado                                                                                                                                        |
| `npm run build:integration` | aprovado                                                                                                                                        |
| `npm run test:integration`  | 184 aprovados e 2 ignorados (casos só de mobile no projeto desktop), em 2,6 min; suíte da conta (13 casos × desktop/mobile) repetida 3× (78/78) |
| `npm run test:e2e`          | 12 aprovados, com cinco referências visuais atualizadas (ver abaixo)                                                                            |

Lighthouse não executado, conforme o handoff.

## Casos (`tests/integration/account.spec.ts`)

1. Navegação: cada item leva à sua rota com o item marcado; as quatro seções não implementadas mostram a página honesta; disclosure mobile abre, navega, fecha e devolve o foco; deslogado vai ao login e volta à seção; `/account` redireciona; histórico.
2. Perfil: editar, salvar, refresh mantém; o cabeçalho e `GET /session` refletem o novo nome; username em uso responde 409 no campo (com foco); versão antiga 409; `null` em e-mail 400.
3. Avatar: escolher imagem, prévia, nada salvo antes de "Salvar", refresh mantém, a imagem salva tem 256×256 em WebP/JPEG; remover e salvar; tipo e tamanho recusados no cliente (GIF, mais de 5 MB) e na API (GIF, mais de 150 KB).
4. Senha: atual errada no campo, com foco; confirmação diferente recusada no cliente; troca válida limpa os campos, mantém a sessão, permite entrar com a nova e não com a antiga; nenhuma senha em claro no estado simulado.
5. Falha parcial: dados salvos e senha recusada no mesmo "Salvar"; resumo por parte, a nova senha digitada permanece.
6. Carteiras (`lin_example`): adicionar e editar a principal, refresh mantém; secundária com "Igual à carteira principal" (descritivos copiados, endereço não); endereço igual ao da principal (outra caixa) 409 no campo; terceira carteira 409; versão antiga 409; endereço inválido 400.
7. Editar o endereço da carteira conectada encerra a conexão; o recibo de um pedido existente mantém a carteira da criação.
8. Favoritos: favoritar no cartão e no detalhe, anúncio, refresh mantém, a Lista de interesse mostra os dois, remover na lista e estado vazio.
9. Reversão otimista: falha HTTP e de rede deixam o coração marcado na hora, revertem e anunciam o erro, com a API sem favoritos; 5 e 4 cliques rápidos terminam no estado da última intenção, igual à API.
10. Isolamento: depois de Ada sair, Lin não vê favoritos, carteiras nem perfil de Ada em nenhum momento (observador de mutações no conteúdo da conta).
11. Deslogado: o coração leva ao login e volta ao detalhe, sem favoritar sozinho.
12. `nft.updated` muda o preço na Lista de interesse.
13. Teclado e foco: barra lateral ou disclosure, mostrar senha (`aria-pressed`) e coração com Enter.

`tests/integration/checkout.spec.ts` (caso 12) foi atualizado: com principal e secundária, escolher WalletConnect mostra o limite e "Editar carteiras"; o "⋮" abre "Editar carteira", que leva a `/account/wallets`.

## Varredura de larguras

Perfil e carteiras em 390, 414, 768 e 1440px, com e-mail e ENS longos e o endereço completo da carteira: `scrollWidth` igual à largura da janela. A primeira varredura encontrou overflow no perfil em todas as larguras: o campo de arquivo do avatar, oculto com `sr-only`, recebia `width: 100%` da regra de campos. Passou a usar `hidden` (é aberto pelo botão "Alterar") e a varredura seguinte ficou sem overflow.

## Problemas encontrados na verificação

- **"Salvar" coberto pela navegação inferior no mobile:** ao rolar até o botão, ele ficava sob a barra fixa (clique interceptado nos testes 2 e 3 mobile). Campos e botões da conta ganharam `scroll-margin-bottom` no mobile.
- **Status da carteira perdido ao cadastrar:** a seção era remontada quando a carteira recebia id (chave pelo id). A chave passou a ser o papel.
- **Foco no primeiro campo inválido depois de erro da API:** era pedido antes de o React renderizar `aria-invalid`; passou a um efeito disparado depois da renderização dos erros.
- **Mesmo texto de status não reanunciado:** o status da carteira é limpo no início de cada salvamento.

## Referências visuais

As referências de início, detalhe (desktop e mobile), carrinho e pagamento mobile mudaram e foram inspecionadas antes de aceitar: o coração dos cartões passou a ser SVG (mesmo desenho do Figma), o detalhe ganhou "♡ Favoritar" com o mesmo ícone, e o "⋮" das carteiras do pagamento se deslocou poucos pixels (agora é um botão com menu). Sem referências novas para perfil e carteiras (opcionais); as capturas de trabalho foram comparadas com as capturas dos frames `9:1238` e `9:1670` fornecidas pelo usuário.

## Revisão do usuário

- Menu da conta do cabeçalho: os novos links não tinham o estilo dos botões (sem altura nem espaçamento); links e "Sair" passaram a ter o mesmo estilo, com "Sair" separado por uma linha.
- Rodapé: "Meu perfil", "Atividade" e "Lista de interesse" levam às rotas da conta.
- Páginas da conta sem rodapé.

Depois dessas mudanças: 184 testes de integração aprovados e 2 ignorados; as referências visuais que mostram o rodapé (início, detalhe, carrinho, pagamento e recibo) mudaram só nos três itens que viraram links e foram atualizadas após inspeção; 12 E2E aprovados.

## Erros de infraestrutura

Nenhum ("Target crashed", navegador fechado, timeout do servidor de pré-visualização, falta de memória ou processo encerrado) nas execuções desta etapa. Não ficaram navegadores do Playwright nem `vite preview` órfãos; o único Vite em execução era o servidor de desenvolvimento do usuário. O painel de navegador do aplicativo não conseguiu registrar o service worker do MSW nesse servidor de desenvolvimento ("Failed to register a ServiceWorker"); a inspeção visual foi feita com capturas do Playwright no build normal.

## Não verificado

- Leitores de tela reais (verificação por papéis, nomes acessíveis, foco e regiões de status).
- Codificação WebP em navegadores sem suporte (o fallback JPEG não foi exercitado no Chromium).
- Revogação das outras sessões após a troca de senha observada em outro dispositivo (verificada só pelo código e pelo estado simulado).
- Teclado virtual e safe areas em dispositivo físico.
