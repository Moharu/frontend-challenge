# Orientações para o agente de programação: inicialização do desafio frontend KURIO

## Objetivo

Inicializar um projeto limpo e executável com as dependências, configurações e infraestrutura mínima necessárias para o desafio KURIO de marketplace de NFTs. Renderizar uma única tela provisória neutra. Parar após verificar a inicialização.

**Não implementar funcionalidades do marketplace, reproduzir telas do Figma ou implantar a aplicação nesta tarefa.**

## Contexto e fontes

- Requisitos do desafio: https://github.com/junglegaming/frontend-challenge/blob/main/README.md
- Referência de design aprovada para implementação futura: https://www.figma.com/design/Zbw0vAAPU80HoDwKVfAcCR/Frontend-Challenge--Copy-?node-id=0-1
- Destino de implantação futuro: Vercel.
- Nome do produto: KURIO.
- A aplicação futura simula APIs REST, autenticação, carteiras, pagamentos e eventos em tempo real. Não deve depender de backend de produção, extensão real de carteira, blockchain ou gateway de pagamento.

Ler o README do desafio e as instruções aplicáveis do repositório antes de começar. Não abrir o Figma nem baixar recursos de design nesta tarefa de inicialização. O link serve de contexto para trabalho futuro.

## Limites do escopo

Permitido:

- Inicializar o projeto, instalar dependências, incluir um arquivo de lock no commit e configurar ferramentas.
- Conectar provedores, roteamento, configuração HTTP e inicialização opcional de mocks.
- Adicionar uma rota provisória e um fallback mínimo para rotas desconhecidas.
- Adicionar um teste básico, configuração de testes e configuração de auditoria Lighthouse.
- Documentar configuração, comandos, variáveis de ambiente, limites de arquitetura e trabalho adiado.

Não permitido:

- Funcionalidades de catálogo, detalhe de NFT, carrinho, checkout, autenticação, perfil, carteira, favoritos ou pedidos.
- Modelos de domínio, endpoints de API, massas de dados, contas fictícias, validações de negócio, estado de negócio persistido ou cenários de eventos.
- Fluxo funcional de compra, conexão de carteira, sistema de sessão ou assinatura de tempo real.
- Navegação de produto, seções de destaque, cartões, formulários de conta, painéis ou reprodução do Figma.
- Bancos de dados, autenticação de terceiros, integrações reais de pagamento ou infraestrutura de servidor.
- Criar repositórios remotos, enviar commits, alterar o repositório do desafio ou implantar na Vercel.
- Declarar que o desafio está concluído ou que resultados de auditoria da tela provisória representam o desempenho final.

## Preparação do diretório de trabalho

1. Inspecionar o diretório de destino e suas instruções antes de gravar arquivos.
2. Preservar o trabalho existente do usuário. Não sobrescrever uma aplicação existente nem substituir seu gerenciador de pacotes sem verificar compatibilidade.
3. Se não existir aplicação, inicializar Vite + React + TypeScript no diretório pretendido do projeto.
4. Usar npm em projeto novo e incluir `package-lock.json` no commit. Se o repositório já tiver gerenciador e arquivo de lock, mantê-los e adaptar todos os comandos de forma consistente.
5. Selecionar uma versão Node.js LTS atualmente suportada e compatível com as dependências escolhidas. Registrá-la em `.nvmrc` e em engines de `package.json`.
6. Verificar a documentação oficial atual dos pacotes ao escolher versões e padrões de configuração. Fixar um conjunto compatível de dependências pelo arquivo de lock. Não misturar versões preliminares às cegas nem copiar instruções de configuração desatualizadas.

## Dependências obrigatórias

Instalar e configurar conforme necessário para a inicialização:

- React e React DOM.
- TypeScript com verificação estrita.
- Vite e seu plugin React.
- TanStack Router para roteamento.
- TanStack Query para infraestrutura de estado remoto.
- Axios como futuro cliente REST.
- Tailwind CSS com a integração adequada à versão principal instalada.
- Configuração shadcn/ui e somente as dependências de apoio exigidas pela configuração escolhida.
- MSW para futuros mocks na camada de rede.
- `socket.io-client` para futuras conexões de tempo real.
- `@mswjs/socket.io-binding` para futura simulação Socket.IO com MSW.
- Playwright para ferramentas E2E e de regressão visual.
- Ferramentas Lighthouse, de preferência Lighthouse CI para execuções reproduzíveis e relatórios.
- ESLint com suporte a TypeScript, React Hooks e React Refresh conforme apropriado.
- Prettier para formatação.
- Definições de tipos Node.js para arquivos de configuração quando necessárias.

Não instalar um segundo roteador, cliente HTTP, gerenciador de estado, framework de backend, SDK blockchain ou biblioteca adicional de componentes de interface. Adiar bibliotecas de formulários e outras dependências opcionais até uma funcionalidade concreta precisar delas.

Verificar e registrar a compatibilidade entre MSW, a integração Socket.IO e `socket.io-client`. Não criar uma conexão de socket para demonstrar compatibilidade nesta tarefa. Se a integração não puder ser validada sem um teste posterior de protocolo, declarar explicitamente essa limitação.

## Organização do projeto

Usar uma estrutura simples com pontos claros de extensão, por exemplo:

```text
src/
  app/
    providers.tsx
    router.tsx
  routes/
    index.tsx
  components/
    ui/
  lib/
    env.ts
    http.ts
    query-client.ts
    utils.ts
  mocks/
    browser.ts
    handlers.ts
  styles/
    globals.css
  main.tsx
tests/
  e2e/
    placeholder.spec.ts
public/
  mockServiceWorker.js
docs/
  bootstrap-scope.md
.env.example
.nvmrc
components.json
playwright.config.ts
lighthouserc.cjs
vercel.json
README.md
ARCHITECTURE.md
```

Adaptar os nomes dos arquivos às ferramentas escolhidas. Evitar gerar módulos de funcionalidades, repositórios, serviços, hooks ou abstrações especulativas vazios. Explicar na documentação os futuros limites entre funcionalidades.

## Integração da infraestrutura inicial

### Roteamento e provedores

- Usar rotas TanStack Router definidas em código nesta pequena inicialização, salvo se convenções existentes exigirem rotas baseadas em arquivos.
- Registrar corretamente os tipos do roteador.
- Criar uma rota raiz, uma rota inicial e um pequeno fallback de página não encontrada.
- Envolver a aplicação com um único cliente/provedor TanStack Query estável.
- Configurar o alias compartilhado `@/` de forma consistente no TypeScript, Vite e shadcn.
- Manter React Strict Mode habilitado.

### HTTP e ambiente

- Criar uma instância Axios com URL base validada e timeout finito.
- Não adicionar ainda interceptores de autenticação, tokens, novas tentativas, chamadas de API ou funções auxiliares de endpoints.
- Fornecer `.env.example` com um conjunto pequeno e documentado de valores públicos de configuração, por exemplo:

```dotenv
VITE_API_BASE_URL=/api
VITE_ENABLE_MOCKS=true
```

- Interpretar booleanos explicitamente; a string `false` não deve habilitar mocks.
- Explicar que valores `VITE_*` são configuração pública definida no build, não segredos.
- Não adicionar URLs de socket não utilizadas nem inventar serviços de backend.

### Infraestrutura de mocks

- Gerar o worker MSW usando as ferramentas da versão instalada.
- Exportar um array vazio de handlers e um worker de navegador que o utilize.
- Carregar mocks dinamicamente somente quando habilitados por configuração.
- Aguardar sua inicialização antes de renderizar para evitar que futuras requisições ocorram antes da interceptação.
- Manter a ativação de mocks disponível em build otimizado; não condicioná-la exclusivamente ao modo de desenvolvimento.
- Não adicionar ainda handlers REST, handlers Socket.IO, eventos de exemplo ou massas de dados de domínio.
- Garantir que o tratamento de requisições não interceptadas não quebre Vite, fontes, imagens ou recursos estáticos. Documentar a política futura pretendida para requisições de API.
- Não suprimir silenciosamente falhas de inicialização do worker.

### Estilos e shadcn

- Inicializar Tailwind e configuração shadcn com variáveis CSS e o alias compartilhado.
- Gerar o mínimo de componentes; não é necessária uma vitrine da biblioteca.
- Fundo, cor de texto, espaçamentos básicos e tipografia legível do sistema são suficientes.
- Não reproduzir ainda o tema completo do KURIO, carregar fontes remotas ou exportar recursos do Figma.

## Tela provisória

Renderizar uma única página acessível e responsiva com os seguintes textos literais da aplicação:

- Título: `KURIO`
- Texto de apoio: `Frontend challenge — project setup complete.`
- Nota pequena: `Marketplace features have not been implemented yet.`

Usar `main` semântico e um único `h1`. Centralizar um bloco simples de conteúdo com espaçamento interno confortável. Sem botões, menu, cartões fictícios de NFT, contadores, controles de carteira ou comportamento interativo de produto.

Definir o título do documento como `KURIO | Frontend Challenge`, uma descrição básica e um atributo de idioma adequado ao texto da tela provisória. Remover logos, contadores e estilos/recursos iniciais não utilizados da demonstração Vite.

A página deve caber em telas estreitas sem transbordamento horizontal e não deve emitir requisições REST ou abrir conexões Socket.IO.

## Ferramentas e comandos

Fornecer scripts funcionais equivalentes a:

```text
dev                Iniciar o servidor de desenvolvimento
dev:mocks          Iniciar o desenvolvimento com mocks explicitamente habilitados
build              Verificar tipos e produzir o build otimizado
preview            Servir o build otimizado localmente
typecheck          Verificar tipos da aplicação e configurações
lint               Executar ESLint sem permitir avisos
format             Formatar os arquivos mantidos de código/configuração
format:check       Verificar a formatação
test:e2e           Executar os testes básicos Playwright
test:e2e:ui        Abrir o executor interativo do Playwright
test:e2e:report    Abrir o relatório HTML dos testes
audit:lighthouse  Executar as verificações Lighthouse configuradas
```

Garantir que os comandos funcionem em Windows e sistemas Unix. Não usar atribuições de ambiente na linha de comando exclusivas de POSIX; usar modo/configuração Vite ou um pequeno auxiliar multiplataforma quando apropriado.

Excluir workers gerados, saída de build, relatórios e arquivos de lock do processamento de formatação/lint conforme apropriado. Ignorar no Git dependências, arquivos locais de ambiente, relatórios, rastros de execução e artefatos de build; manter `.env.example` e o arquivo de lock.

## Configuração Playwright

- Configurar projetos Chromium para desktop e dimensão de tela mobile. Incluir larguras de 1440px desktop e 390px mobile.
- Usar servidor local gerenciado e URL base determinística.
- Configurar relatório HTML, capturas de tela em falhas e rastros de execução retidos em falhas.
- Adicionar um teste básico que verifique título e textos da tela provisória, capture erros de página não tratados e verifique transbordamento horizontal.
- Manter o teste isolado e independente de serviços externos.
- Não adicionar testes de funcionalidades futuras, inventários de testes ignorados ou referências visuais provisórias.
- Documentar como instalar os binários de navegador necessários a partir de uma cópia limpa do repositório.

## Configuração Lighthouse

- Configurar auditoria sobre o build otimizado local, nunca sobre o servidor de desenvolvimento Vite.
- Tornar os perfis mobile e desktop reproduzíveis e manter relatórios HTML/JSON.
- Configurar três execuções por perfil quando suportado; documentar que o relatório final deve usar medianas por categoria.
- O único alvo atual de auditoria é `/`. A auditoria do detalhe de NFT fica adiada até que a rota exista.
- Documentar as metas finais do desafio: desempenho 90, acessibilidade 95, boas práticas 95 e SEO 90; registrar LCP, CLS e TBT na fase de implementação final.
- Não declarar que o marketplace atingiu essas metas com base nesta tela provisória.

## Somente preparação Vercel

- Configurar a saída do build Vite e o fallback SPA necessários para acesso direto e recarregamento de rotas.
- Garantir que o worker MSW e outros arquivos estáticos continuem diretamente acessíveis, em vez de receberem o HTML de fallback.
- Documentar a variável de ambiente pretendida para habilitar mocks na demonstração.
- Não criar/vincular projeto Vercel nem implantar. Nenhuma URL pública é esperada nesta tarefa.

## Documentação

Escrever um README conciso com pré-requisitos, instalação, configuração de ambiente, scripts, ativação de mocks, instalação do navegador e build/pré-visualização locais.

Escrever um `ARCHITECTURE.md` curto explicando os limites atuais entre provedor/roteador/HTTP/mocks. Diferenciar claramente ferramentas instaladas de funcionalidades implementadas. Registrar estas restrições futuras sem implementá-las:

- Estado da descoberta baseado na URL.
- Caches por usuário e limpeza de sessão.
- Transporte de ETH como string decimal com aritmética precisa.
- Cotações determinadas pela API e criação idempotente de pedidos.
- Eventos Socket.IO versionados e reconciliação REST.
- Mocks na camada de rede compartilhados entre desenvolvimento, demonstração e testes.
- Composições desktop/mobile compartilhando lógica de negócio.

Em `docs/bootstrap-scope.md`, registrar a configuração concluída, escolhas de pacotes/ambiente, verificação de protocolo adiada e exclusões explícitas de funcionalidades.

## Verificação e critérios de parada

Antes de finalizar:

1. Confirmar que as dependências são instaladas de forma reproduzível com o arquivo de lock versionado.
2. Executar verificação de tipos, lint, verificação de formatação e build otimizado.
3. Executar o teste básico Playwright da tela provisória nos projetos desktop e mobile.
4. Verificar que a tela provisória inicia com mocks habilitados e desabilitados, sem erros de inicialização.
5. Executar uma verificação básica da configuração Lighthouse sobre o build otimizado e confirmar a geração de relatórios. Identificá-los como exclusivos da inicialização.
6. Confirmar ausência de chamadas REST ou conexões Socket.IO da aplicação, handlers de negócio e funcionalidades de marketplace implementadas.
7. Confirmar que nenhuma implantação ou alteração de repositório remoto ocorreu.

Se uma restrição de ambiente impedir instalação ou verificação, informar o comando exato e a limitação. Nunca declarar aprovada uma verificação não executada.

Retornar um resumo conciso dos arquivos/configurações adicionados, versões dos pacotes instalados, verificações executadas e resultados, além das limitações restantes de configuração. **Parar na tela provisória. Não prosseguir para implementação de funcionalidades.**
