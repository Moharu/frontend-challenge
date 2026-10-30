# Verificação dos pedidos

Evidências executadas em 2026-10-30 sobre a árvore de trabalho da etapa de pedidos (sem commit), partindo de `83f4a2b`. Ambiente: WSL2, Node 24.22.0, npm 11.19.1, Chromium headless do Playwright, 2 workers.

## Verificações automatizadas

| Comando                     | Resultado                                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`         | aprovado (dentro de `npm run build`)                                                                                                              |
| `npm run lint`              | aprovado, com `check:bom`                                                                                                                         |
| `npm run format:check`      | aprovado                                                                                                                                          |
| `npm run build`             | aprovado                                                                                                                                          |
| `npm run build:integration` | aprovado                                                                                                                                          |
| `npm run test:integration`  | 152 aprovados e 2 ignorados (casos só de mobile no projeto desktop), em 2,1 min; suíte de pedidos (15 casos × desktop/mobile) repetida 3× (90/90) |
| `npm run test:e2e`          | 12 aprovados: os 10 anteriores e as referências visuais do recibo confirmado (desktop e mobile)                                                   |

Lighthouse não executado, conforme o handoff.

## Casos (`tests/integration/orders.spec.ts`)

1. Compra completa: pendente → confirmado com recibo; o carrinho perde só o que foi comprado.
2. Linha acrescentada enquanto o pedido está pendente permanece depois da confirmação.
3. Recusa: motivo, carrinho intacto, estoque reservado na criação e liberado na recusa, "Voltar ao checkout".
4. Cliques repetidos rápidos e duas abas com a mesma chave: um único pedido.
5. Resposta perdida depois da criação: a nova tentativa com a mesma chave recupera o mesmo pedido.
6. Mesma chave com corpo diferente: 409 na API; mesmo corpo (outra ordem de propriedades): o mesmo pedido.
7. Cotação alterada entre a revisão e o envio: 409 `QUOTE_CHANGED` no servidor e nova confirmação na interface.
8. Refresh na página do pedido pendente e no checkout durante o envio, sem duplicar.
9. Socket desconectado durante o pedido: a reconexão reconcilia por REST.
10. `order.updated` duplicado, antigo ou de outro usuário não regride nem vaza (segundo cliente Socket.IO real autenticado como outro usuário não recebe o evento).
11. Recibo imutável: preço e nome mudam depois da confirmação, o recibo não.
12. Pedido de outro usuário: 403 na API e página com erro.
13. Sessão expirada com pedido pendente: novo login e retorno à página do pedido.
14. Teclado, foco e anúncios nos estados; "Ver no Etherscan" informa indisponibilidade.
15. Pendências: lista de definição válida no resumo e cupom expirado removível.

Os testes do checkout foram atualizados para a criação do pedido (caso 4 termina em `/orders/order-1`; caso 8 mantém o pagamento pendente e termina no pedido; caso 9 confere o total do pedido depois de "Revisei…").

## Varredura de larguras

Página do pedido pendente e confirmada em 390, 414, 768 e 1440px, nos projetos desktop e mobile: `scrollWidth` igual à largura da janela e nenhum elemento de `main` além dela.

## Erros de infraestrutura e instabilidade

- **Nenhum erro de infraestrutura** ("Target crashed", navegador fechado, timeout do servidor de pré-visualização, falta de memória ou processo encerrado) nesta rodada.
- **Falha repetida em `session.spec.ts` › "teclado e foco no login…" (session-mobile), só na suíte completa com 2 workers.** Falhou em duas execuções completas e passou 6/6 isolado. Investigado: o Escape no aviso de indisponibilidade ("Continuar com Google") fechava também o diálogo de login. O Radix só encaminha o Escape à camada superior depois que os efeitos dela rodam; sob carga, o teste pressionava Escape antes disso. Não é regressão dos pedidos (o teste e os componentes não mudaram). Correção no teste: esperar o foco dentro do aviso antes do Escape (`noticeReady`). Execução completa seguinte: 152 aprovados.
- Antes e depois de cada suíte não havia processos Chromium do Playwright nem `vite preview` órfãos.

## Referências visuais

`tests/e2e/order.spec.ts`: recibo confirmado em página inteira, desktop e mobile, com o pedido criado pela API real e relógio fixo (2026-07-29T12:00:00Z, depois 12:00:05Z para passar do atraso do pagamento). A referência da transação (aleatória) e os avisos são mascarados; a navegação inferior fixa é ocultada na captura de página inteira. Inspecionadas antes de aceitar.

## Não verificado

- Leitores de tela reais (verificação por papéis, nomes acessíveis, foco e regiões `aria-live`).
- Duas abas com chaves diferentes para o mesmo corpo (fora do escopo de `sessionStorage`; ver limitações em `docs/orders.md`).
- Teclado virtual e safe areas em dispositivo físico.
