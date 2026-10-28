# Bootstrap scope and handoff

Completed on 2026-10-28. This is infrastructure and a neutral placeholder, not the marketplace implementation. No Figma access, remote mutation, commit, push, project linking or deployment occurred. The lockfile is ready for a future commit with the rest of the bootstrap.

## Runtime and packages

Node 24.22.0 LTS, npm 11.19.1. `.nvmrc` pins the runtime; engines require Node 24 and npm 11. Vite 8 uses the React plugin and Tailwind 4 Vite plugin. TypeScript 5.9 uses strict checking. ESLint 10 and its plugins have compatible peer requirements. The lockfile pins the complete dependency graph.

| Package                       | Resolved version |
| ----------------------------- | ---------------- |
| `@eslint/js`                  | 10.0.1           |
| `@lhci/cli`                   | 0.15.1           |
| `@mswjs/socket.io-binding`    | 0.2.0            |
| `@playwright/test`            | 1.64.1           |
| `@tailwindcss/vite`           | 4.3.3            |
| `@tanstack/react-query`       | 5.105.0          |
| `@tanstack/react-router`      | 1.170.46         |
| `@types/node`                 | 24.19.2          |
| `@types/react`                | 19.3.0           |
| `@types/react-dom`            | 19.3.0           |
| `@vitejs/plugin-react`        | 6.1.2            |
| `axios`                       | 1.21.0           |
| `class-variance-authority`    | 0.7.1            |
| `clsx`                        | 2.1.1            |
| `eslint`                      | 10.13.0          |
| `eslint-plugin-react-hooks`   | 7.1.1            |
| `eslint-plugin-react-refresh` | 0.5.7            |
| `globals`                     | 17.13.0          |
| `msw`                         | 2.15.0           |
| `prettier`                    | 3.9.10           |
| `react`                       | 19.3.1           |
| `react-dom`                   | 19.3.1           |
| `socket.io-client`            | 4.8.4            |
| `tailwind-merge`              | 3.7.0            |
| `tailwindcss`                 | 4.3.3            |
| `typescript`                  | 5.9.3            |
| `typescript-eslint`           | 8.72.1           |
| `vite`                        | 8.3.5            |

## Compatibility and limitations

`@mswjs/socket.io-binding@0.2.0` requires MSW `^2.10.2`; MSW 2.15.0 satisfies that peer. Its published development dependency uses Socket.IO client `^4.8.1`, compatible with the selected 4.8.4. The binding uses Engine.IO parser 5 and Socket.IO parser 4. This establishes package-level compatibility only. A later browser protocol test must verify the client's WebSocket transport, handshake, event encoding, disconnection and reconnection through MSW. Long-polling support is not assumed. No socket connection was created at bootstrap.

The latest Lighthouse CI 0.15.1 brings transitive development-tool advisories: `npm audit` reports 16 (13 high, 1 moderate, 2 low), all in the Lighthouse CI chain. No forced downgrade or cross-major transitive override was applied. These remain a tooling limitation to revisit before upgrading or accepting untrusted audit inputs; they are not imported into the application. The MSW package postinstall is skipped by npm 11's script approval policy; explicit worker generation succeeded and browser startup was verified.

## Boundaries and exclusions

Configured Query provider, registered code-based router, Axios instance with validated environment and finite timeout, dynamic awaited empty MSW worker, Tailwind/shadcn aliases and utilities, Chromium desktop/mobile tests, optimized-build Lighthouse CI and filesystem-first Vercel SPA configuration.

No catalog, NFT detail, cart, checkout, account/authentication, profile, wallet, favorites, orders, domain models, contracts, REST endpoints, fixtures, persistence, business validation, network scenarios, Socket.IO events, external integrations, product navigation or design reproduction. Future architecture constraints are recorded in `ARCHITECTURE.md`.

## Official references consulted

- [Vite setup and runtime requirements](https://vite.dev/guide/)
- [Node release lifecycle](https://nodejs.org/en/about/previous-releases)
- [TanStack Router quick start](https://tanstack.com/router/latest/docs/quick-start)
- [Tailwind Vite integration](https://tailwindcss.com/docs/installation/using-vite)
- [shadcn manual setup](https://ui.shadcn.com/docs/installation/manual)
- [MSW browser integration](https://mswjs.io/guides/integrations/browser)
- [Socket.IO binding source](https://github.com/mswjs/socket.io-binding)
- [Playwright configuration](https://playwright.dev/docs/test-configuration)
- [Lighthouse CI configuration](https://googlechrome.github.io/lighthouse-ci/docs/configuration.html)

Package registry manifests were also checked for resolved versions and peer requirements. The supplied local challenge README was treated as authoritative and preserved verbatim in `docs/challenge-requirements.md`.

## Verification

All browser/audit observations are agent-run; no human visual signoff is claimed.

| Check                                 | Outcome                                                                                                                                       |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                              | Passed with the checked-in-ready lockfile; advisory counts above remain                                                                       |
| `npm run typecheck` / `npm run build` | Passed, including both default and `--mode mocks` optimized builds                                                                            |
| `npm run lint`                        | Passed with ESLint 10 and zero warnings                                                                                                       |
| `npm run format:check`                | Passed                                                                                                                                        |
| `npm run test:e2e`                    | Two tests passed for each mock mode, 1440px desktop and 390px mobile                                                                          |
| Worker and routing inspection         | Enabled controller points to `/mockServiceWorker.js`; worker asset responds 200 with `text/javascript`; direct unknown-route fallback renders |
| Screenshot review                     | Agent inspected desktop/mobile screenshots; copy is readable, centered and wraps without horizontal overflow                                  |
| Runtime/source review                 | No observed REST/Socket.IO traffic, browser console/page errors, business handlers or feature implementation                                  |
| `npm run audit:lighthouse`            | Passed; three HTML and JSON reports per profile retained locally in `reports/lighthouse`                                                      |
| Remote actions                        | No deployment, remote repository mutation or push                                                                                             |

The sandbox prevented npm DNS access (`EAI_AGAIN`) and local server binding (`listen EPERM 127.0.0.1:4173`). Network installation, browser execution and local audit servers succeeded with elevated execution. A premature test attempt overlapped dependency reinstall and was discarded; the completed install was followed by successful builds and browser checks. This host's `mktemp` produced Windows-style Lighthouse profile directories inside the working directory; those generated profiles were removed after the completed audit.

Bootstrap-only category medians (performance / accessibility / best practices / SEO): mobile **98 / 100 / 96 / 91**; desktop **100 / 100 / 96 / 91**. Environment: Linux x86_64, Node 24.22.0, Lighthouse CI 0.15.1 with Lighthouse 12.6.1, Playwright-managed Headless Chromium 156, localhost optimized build with mocks enabled, default Lighthouse simulated mobile throttling and desktop preset respectively. These are placeholder measurements and provide no evidence of marketplace performance. No token or upload service was configured; reports use local filesystem output.

The final local `dist/` is rebuilt with mocks disabled. Vercel filesystem-first routing is prepared but cannot be verified on the platform without a later authorized deployment. Socket.IO protocol verification and marketplace functionality remain deferred.
