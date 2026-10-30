# Próxima etapa: passada de desempenho

## Objetivo

Atingir as metas do Lighthouse da seção 10 de `docs/challenge-requirements.md` em início e detalhe do NFT, nos perfis mobile e desktop, medindo o site publicado na Vercel, sem simplificações exclusivas para a auditoria.

| Categoria      | Meta |
| -------------- | ---: |
| Performance    | ≥ 90 |
| Accessibility  | ≥ 95 |
| Best Practices | ≥ 95 |
| SEO            | ≥ 90 |

**Situação atual** (medianas de três execuções, build local servido por `vite preview`, em `docs/session-verification.md`): desempenho mobile 87 no início e 82 no detalhe (LCP de cerca de 3,3 s e 3,9 s); desktop 98–99. Acessibilidade, boas práticas e SEO em 100. O gargalo identificado nas etapas anteriores é a cadeia crítica antes da primeira renderização: HTML → bundle principal → chunk do MSW e registro do service worker → chunk da rota → `GET /api/...` → imagem.

Fora desta etapa: funcionalidades novas, mudanças visuais intencionais e a revisão final de acessibilidade e documentação (exceto o que esta etapa precisar documentar).

## Ponto de partida e referências

- Repositório: https://github.com/Moharu/frontend-challenge
- Último commit revisado: `9c93652` (implantação na Vercel), publicado em produção (implantação `dpl_EAfG7yhegqHoAWVGRnaZxQNHivQ8`, estado READY).
- URL publicada: https://jungle-gaming-challenge-joao.vercel.app (registrada em `docs/deploy-verification.md` e no README).
- Requisitos: `docs/challenge-requirements.md`, seção 10.
- Evidências e análises anteriores: `docs/discovery-verification.md`, `docs/cart-verification.md`, `docs/session-verification.md` e `docs/deploy-verification.md`.
- Configuração atual: `lighthouserc.cjs`, `scripts/audit-lighthouse.mjs`, `scripts/lighthouse-medians.mjs`, `vite.config.ts` (`kurio-preload-mocks`), `src/main.tsx` (inicialização que aguarda o MSW), `src/mocks/browser.ts` e `vercel.json`.

Inspecione o checkout atual antes de editar e preserve trabalho mais recente. Não crie commit, push ou deploy sem autorização separada. Cada push autorizado em `main` reimplanta o site; meça sempre o commit efetivamente publicado.

## Regras que não podem ser quebradas

O requisito exige que a auditoria carregue "as imagens, fontes e funcionalidades da entrega, sem simplificações exclusivas para melhorar a pontuação". Portanto:

- Não desligue o MSW, o Socket.IO simulado, imagens ou fontes durante a auditoria. Não detecte o Lighthouse (user agent, flags) para mudar o comportamento.
- Não remova conteúdo, seções ou funcionalidades. Não reduza a qualidade das artes a ponto de afetar a fidelidade visual.
- Não fabrique respostas da API em componentes. Os dados continuam vindo do Axios passando pelo MSW.
- Nenhuma regressão funcional: todas as suítes continuam passando. Referências visuais que mudarem precisam ser inspecionadas e justificadas.

## 1. Medição de referência

- Ajuste a configuração para medir uma URL informada por variável (por exemplo `LIGHTHOUSE_URL`), além do build local.
  - A **medição oficial** é a da URL publicada.
  - A local, com `vite preview`, serve como referência reproduzível e para validar mudanças antes do push.
  - Mantenha três execuções por página e perfil, as medianas por categoria e o registro de LCP, CLS e TBT.
- Antes de qualquer otimização, meça a URL publicada e o build local e registre a linha de base.
- Use o painel de desempenho ou os traces do Lighthouse para **confirmar o gargalo atual** antes de mudar código:
  - tempo até o service worker controlar a página;
  - tamanho e ordem dos chunks;
  - momento da requisição da API;
  - descoberta da imagem do LCP.

  Não otimize por suposição.

## 2. Alavancas a investigar

Investigue estas frentes na ordem que os dados indicarem. Não é obrigatório aplicar todas: aplique as que mostrarem ganho medido e registre as descartadas e o motivo.

- **Renderizar antes de o MSW estar pronto.** Hoje a aplicação só renderiza depois de o worker controlar a página.
  - Avalie renderizar imediatamente o layout público (cabeçalho, hero, skeletons) e fazer só as requisições à API aguardarem a prontidão dos mocks. Por exemplo, um interceptador do Axios que espera uma promessa de prontidão, com o socket conectando depois dela.
  - No início, o LCP é o hero estático, que então pode pintar sem esperar a API.
  - Garanta que nenhuma requisição saia antes da interceptação, nem por prefetch ou pelo socket. A inicialização continua falhando de forma clara se o service worker não puder ser registrado.
- **Detalhe do NFT.** O LCP depende da arte, que vem dos dados da API. Encurte a cadeia: iniciar a requisição do detalhe o mais cedo possível (por exemplo, no `loader` da rota em paralelo com o chunk), `fetchpriority="high"` e `sizes` corretos na arte principal, e pré-conexão ou pré-carregamento quando aplicável. Não incorpore dados da seed no HTML nem nos componentes.
- **Service worker na primeira visita.** Meça o custo do registro e da ativação em perfil limpo, que é como o Lighthouse mede. Verifique se a espera por `controlledByActiveWorker` é maior que o necessário e documente a estratégia.
- **JavaScript.** Analise os chunks (por exemplo, com o relatório do Rollup ou o `vite build --mode` com análise). Possibilidades:
  - código de conta, checkout e pedidos fora do bundle inicial das rotas públicas;
  - Socket.IO carregado depois da primeira pintura;
  - dependências duplicadas;
  - código só de testes fora do build normal (já verificado; confirme).
- **Temporizador de resolução de pagamentos (pendência registrada).** `src/mocks/browser.ts` roda `resolveDue` a cada 250 ms em todas as páginas, inclusive para visitantes, e cada execução relê e interpreta todo o retrato do `localStorage`. Rode-o somente enquanto houver pedidos pendentes, sem perder a resolução que sobrevive ao reload.
- **Trabalho na inicialização.** Leitura, validação e cópias (`structuredClone`) do estado simulado no caminho crítico. Meça e reduza se for relevante para o TBT.
- **Fontes.** Roboto Mono local: subset dos caracteres usados (latin com acentos do pt-BR), `font-display` adequado, `preload` da variante usada acima da dobra e nenhuma variante sem uso.
- **Imagens.** Confirme que as variantes responsivas cobrem as larguras reais em 390, 768 e 1440 px e que nada acima da dobra é carregado com `loading="lazy"`.
- **Cabeçalhos da Vercel.** Confirme a compressão (Brotli ou gzip) e os caches definidos na implantação, e ajuste se a medição mostrar perda.

Depois de cada mudança relevante, meça de novo (build local e, depois do push autorizado, a URL) e registre a diferença. Mantenha os demais escores em 100 ou acima das metas.

## 2.1 Pendências da revisão da implantação

- **Espera pelo controle do service worker na inicialização.** Os commits `d06407d` e `56365d3` fizeram `src/main.tsx` esperar que o worker ativo do registro atual controle a página antes de renderizar, com limite de 3 s. `docs/deploy-verification.md` registra que essas correções ficaram como precaução, **sem prova de que sejam necessárias**, e que a causa confirmada das requisições desviadas foi outra (`CLIENT_CLOSED` no `beforeunload`).
  - Essa espera fica no caminho crítico de toda primeira visita, que é exatamente como o Lighthouse mede, e no pior caso adia a renderização em até 3 s.
  - Meça o tempo real gasto em `controlledByActiveWorker` numa visita limpa ao site publicado.
  - Mantenha somente a espera comprovadamente necessária. Se a alavanca "renderizar antes de o MSW estar pronto" for aplicada, essa espera passa a bloquear apenas as requisições à API, não a renderização.
  - Garanta que nenhuma requisição `/api` saia antes da interceptação, comprovado pela suíte de implantação, que já falha nesse caso.
- **Cache das artes, fontes e assets do Figma sem hash.** `vercel.json` aplica `max-age=604800` (uma semana) a `/assets/(art|figma|fonts)/`, que são arquivos de `public/` sem hash no nome.
  - Isso tem dois custos: uma arte ou fonte alterada pode ficar desatualizada por até uma semana, e visitas repetidas não ganham o cache `immutable`.
  - Avalie servir esses arquivos com hash no nome (importando-os pelo Vite ou gerando nomes versionados no script de artes) para aplicar `public, max-age=31536000, immutable`. Se não compensar, documente o motivo e mantenha a regra atual.
- **Tolerância da verificação de implantação.** `tests/deploy/deploy.spec.ts` aceita uma requisição `/api` fora do worker quando uma navegação começa até 2 s depois. Se a inicialização mudar, confirme que a tolerância continua cobrindo só o caso documentado da página em descarte e que nenhuma requisição da página nova passa a ser aceita.

## 3. Relatórios entregues

O requisito pede que se entreguem "relatórios HTML/JSON, versões das ferramentas, ambiente e condições de execução". Hoje `reports/` é ignorado pelo Git.

- Versione os relatórios **finais** (HTML e JSON das três execuções por página e perfil, da URL publicada) num diretório rastreado, por exemplo `docs/lighthouse/`, com tamanho razoável. Os relatórios intermediários continuam ignorados.
- Registre em `docs/performance.md`:
  - versões do Lighthouse, do `@lhci/cli`, do Chromium e do Node;
  - sistema e máquina (WSL2), perfis (mobile com throttling simulado padrão; desktop com `preset=desktop`), URL e commit medidos, data;
  - tabela de medianas por categoria, LCP, CLS e TBT, para a URL publicada e para o build local;
  - histórico das mudanças com o efeito medido de cada uma;
  - alavancas avaliadas e descartadas, com o motivo;
  - se alguma meta ainda não for atingida, a justificativa com as causas identificadas, como exige o requisito.
- O comando para reproduzir a auditoria fica no README.

## 4. Verificação e entrega

Execute tipos, lint (com `check:bom`), formatação, build, build de integração, testes de integração, E2E e `npm run test:deploy` contra o build local e contra a URL publicada, com o limite de workers. Nesta etapa o Lighthouse é o objetivo: rode-o conforme as seções 1 a 3.

**Fique atento a erros de infraestrutura** ("Target crashed", navegador fechado, timeout do servidor de pré-visualização, falta de memória, processo encerrado). Isso vale também para as execuções do Lighthouse, que já deixaram perfis temporários no WSL. Registre as ocorrências em `docs/performance.md`, investigue as repetições e confirme ao final que não ficaram navegadores, servidores de pré-visualização nem perfis temporários órfãos.

Peça autorização ao usuário antes de cada commit e push necessários para medir a URL publicada.

Ao concluir, informe arquivos alterados, as medianas finais (URL publicada e local), o que foi aplicado e descartado e os resultados dos testes.

**Pare ao fim da passada de desempenho. Não avance para a revisão final de acessibilidade e documentação sem nova autorização.**
