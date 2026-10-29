# Verificação do checkout

Evidências executadas em 2026-10-29 sobre a árvore de trabalho da etapa do checkout (sem commit), partindo de `fcf352e`. Ambiente: WSL2, Node 24.22.0, npm 11.19.1, Chromium headless do Playwright.

## Verificações automatizadas

| Comando                     | Resultado                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `npm run typecheck`         | aprovado                                                                                                                 |
| `npm run lint`              | aprovado                                                                                                                 |
| `npm run format:check`      | aprovado                                                                                                                 |
| `npm run build`             | aprovado                                                                                                                 |
| `npm run build:integration` | aprovado                                                                                                                 |
| `npm run test:integration`  | 118 aprovados (eram 93): +25 do checkout (13 casos × desktop/mobile, 1 só mobile); suíte do checkout repetida 3× (75/75) |
| `npm run test:e2e`          | 10 aprovados: as 8 anteriores e as novas referências visuais do pagamento (desktop e passo da carteira no mobile)        |

Uma execução completa teve uma falha "Target crashed" do navegador num teste de sessão; o mesmo teste passou 10/10 em seguida (5 repetições × 2 viewports). Lighthouse não executado, conforme o handoff (haverá uma etapa de desempenho dedicada).

## Casos (`tests/integration/checkout.spec.ts`)

1. Carrinho → "Conectar e finalizar" → `/checkout` autenticado; deslogado, login sobre o carrinho e retorno ao checkout; acesso direto e refresh.
2. Carrinho vazio e carrinho com conflito não abrem o checkout (voltam ao carrinho com aviso).
3. Pré-preenchimento pela carteira e pela conta; trocar para "Reserva" mantém o digitado e atualiza rede, tipo e endereço.
4. Validação por campo (indicação e ENS ou carteira secundária), foco no primeiro inválido, regras só no erro (sem ajudas de antemão); "Nome ENS" é a lista ".eth" + nomes ENS das carteiras; opcionais vazios passam.
5. `lin_example` cadastra uma carteira no checkout: endereço inválido recusado no formulário; a carteira vira `primary` e fica selecionada e conectada; a API recusa endereço inválido (400) e duplicado sem diferenciar maiúsculas (409); a segunda vira `secondary`.
6. Conexão: "Conectando…", aprovada, recusada com nova tentativa e desconexão detectada ao confirmar (desktop) e ao recuperar o foco (mobile), com "Reconectar".
7. Taxa da rede da carteira: Ethereum 0.016 ETH × Polygon 0.002 ETH, total pela API.
8. Revalidação: sem mudanças, diálogo "Revisão concluída"; mudança de preço, cupom expirado e esgotamento exigem nova confirmação ou ajuste, mostrando o que mudou.
9. (8b) Cotação expirada renovada automaticamente com aviso de mudança de preço, sem trocar os valores exibidos.
10. `nft.updated` durante o checkout: aviso e nova cotação; valores só mudam depois de "Revisei…".
11. Mobile: passos na URL, voltar, avançar e refresh; não avança com passo inválido nem sem carteira conectada; link direto para um passo posterior volta ao passo que precisa de atenção; foco no título do passo.
12. Expiração no checkout preserva o rascunho; logout descarta rascunho e carteiras; outro usuário não vê rascunho nem carteiras; rascunho de outro usuário é removido ao entrar.
13. Teclado e foco: setas nos grupos de rádio das carteiras e dos provedores, provedor sem carteira abre o cadastro com foco e provedor pré-selecionado, região única de avisos, menu "⋮" com aviso de indisponibilidade.

## Problemas encontrados na verificação

- O aviso flutuante cobria a barra de ação no mobile (e capturava cliques): os avisos não recebem mais cliques, aparecem no topo no checkout mobile, e o estado da conexão é anunciado pela própria região de status.
- Espaço vazio no fim das páginas do checkout mobile (reserva da navegação inferior, que fica oculta): removido.
- Overflow horizontal com valores ETH muito longos (390/414px) e em 768px: valores quebram linha e, entre 701 e 1000px, as colunas são empilhadas. Varredura em 390, 414, 768 e 1440px sem overflow.
- Revisão manual do usuário: rótulos só com ou sem asterisco (sem "(opcional)"), placeholder de "ENS ou carteira secundária" cortado (agora cabe inteiro em 390px e no desktop, medido), ajudas de formato só no erro e "Nome ENS" como lista, como no frame.
- O formulário de carteira tirava o foco da página quando aberto desde o início (usuário sem carteiras): só recebe foco quando o usuário o abre.

## Referências visuais

`tests/e2e/checkout.spec.ts`: desktop em página inteira e mobile no passo da carteira (viewport de 390×844, porque a captura de página inteira desenha a barra fixa no meio da página). Avisos transitórios são mascarados. Inspecionadas e comparadas com as capturas dos frames `11:2862` e `16:748` fornecidas pelo usuário; diferenças registradas em `docs/checkout.md`.

## Não verificado

- Leitores de tela reais (verificação por papéis, nomes acessíveis, foco e regiões de status).
- Teclado virtual e safe areas em dispositivo físico.
- Zoom de 200% além da varredura de larguras.
- Cotação com várias abas abertas (segue a política de abas do retrato simulado).

## Correções da revisão de `ca0fd2f`

Rodada guiada por `docs/handoffs/coding-agent-checkout-fixes-draft-pt-br.md`.

1. **Cupom expirado sem explicação:** uma única regra de validade (`couponStatus`) para aplicar, exibir o carrinho e cotar (a cotação reaproveita o desconto de `viewCart`). O carrinho passou a responder `couponRemoved`, sem desconto; o código expirado fica guardado só como informação (decisão em `docs/cart.md`). Carrinho e checkout mostram o motivo em região de status, inclusive na primeira cotação. Novo teste 8c (cupom expirado antes de abrir: carrinho e primeira cotação com o motivo e o mesmo total); o caso de expiração durante o checkout continua exigindo nova confirmação.
2. **Conflito de carteira pelo texto:** `validateWallet` devolve `duplicate` explicitamente; o handler escolhe 409 ou 400 por esse indicador. Novo projeto `contracts-unit` (`tests/integration/wallets.spec.ts`) verifica o indicador independentemente das mensagens; os testes de 400 e 409 da API continuam.
3. **BOM:** removido dos seis arquivos apontados (somente os 3 primeiros bytes). A causa foi a escrita por `Set-Content`/`Add-Content` do PowerShell do agente, que grava BOM; arquivos passam a ser escritos sem ele. `npm run lint` agora executa `check:bom` (`scripts/check-bom.mjs`), que falha com arquivo versionado iniciado por BOM.
4. **Workers:** as duas configurações do Playwright usam `workers: 2` por padrão (sobrescrevível com `PW_WORKERS` ou `--workers`), documentado no README.

Resultados, com 2 workers: tipos, lint (com `check:bom`), formatação, build normal e de integração aprovados; 122 testes de integração aprovados e 2 ignorados (casos só de mobile no projeto desktop), em 1,6 min (antes, sem limite, ~55 s); 10 E2E aprovados. **Erros de infraestrutura:** nenhum ("Target crashed", navegador fechado, timeout do servidor de pré-visualização, falta de memória ou processo encerrado) nas execuções desta rodada. Antes e depois de cada suíte não havia processos Chromium do Playwright nem `vite preview` órfãos. Lighthouse não executado, conforme o handoff.
