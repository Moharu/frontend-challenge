# Coding agent handoff: bootstrap the KURIO frontend challenge

## Objective

Initialize a clean, runnable project with the dependencies, configuration, and minimal infrastructure needed for the KURIO NFT marketplace challenge. Render one neutral placeholder screen. Stop after the bootstrap is verified.

**Do not implement marketplace features, reproduce Figma screens, or deploy the application in this task.**

## Context and sources

- Challenge requirements: https://github.com/junglegaming/frontend-challenge/blob/main/README.md
- Approved design reference for future implementation: https://www.figma.com/design/Zbw0vAAPU80HoDwKVfAcCR/Frontend-Challenge--Copy-?node-id=0-1
- Deployment target for later: Vercel.
- Product name: KURIO.
- The eventual application simulates REST APIs, authentication, wallets, payments, and realtime events. It must not depend on a production backend, real wallet extension, blockchain, or payment gateway.

Read the challenge README and applicable repository instructions before starting. Do not open Figma or download design assets for this bootstrap task. The link is context for later work.

## Scope boundaries

Allowed:

- Initialize the project, install dependencies, commit a lockfile, and configure tooling.
- Wire providers, routing, HTTP configuration, and optional mock initialization.
- Add one placeholder route and a minimal unknown-route fallback.
- Add a smoke test, test configuration, and Lighthouse audit configuration.
- Document setup, commands, environment variables, architecture boundaries, and deferred work.

Not allowed:

- Catalog, NFT detail, cart, checkout, authentication, profile, wallet, favorite, or order features.
- Domain models, API endpoints, fixtures, fake accounts, business validation, persisted business state, or event scenarios.
- A functional purchase flow, wallet connection, session system, or realtime subscription.
- Product navigation, hero sections, cards, account forms, dashboards, or Figma reproduction.
- Databases, third-party authentication, real payment integrations, or server infrastructure.
- Creating remote repositories, pushing commits, changing the challenge repository, or deploying to Vercel.
- Claims that the challenge is complete or that placeholder audit results represent final performance.

## Workspace handling

1. Inspect the target directory and its instructions before writing files.
2. Preserve existing user work. Do not overwrite an existing application or replace its package manager without checking compatibility.
3. If no application exists, initialize Vite + React + TypeScript in the intended project directory.
4. Use npm for a new project and commit `package-lock.json`. If the repository already has a package manager and lockfile, retain them and adapt commands consistently.
5. Select a currently supported Node.js LTS version compatible with the selected dependencies. Record it in `.nvmrc` and `package.json` engines.
6. Verify current official package documentation when selecting versions and setup patterns. Pin a compatible dependency set through the lockfile. Do not blindly mix prereleases or copy outdated setup instructions.

## Required dependencies

Install and configure these as appropriate for bootstrap:

- React and React DOM.
- TypeScript with strict checking.
- Vite and its React plugin.
- TanStack Router for routing.
- TanStack Query for remote-state infrastructure.
- Axios as the future REST client.
- Tailwind CSS using the integration appropriate to its installed major version.
- shadcn/ui configuration and only the supporting dependencies required by the selected setup.
- MSW for future network-level mocks.
- `socket.io-client` for future realtime connections.
- `@mswjs/socket.io-binding` for future MSW Socket.IO simulation.
- Playwright for E2E and visual regression tooling.
- Lighthouse tooling, preferably Lighthouse CI for repeatable runs and report artifacts.
- ESLint with TypeScript, React Hooks, and React Refresh support as appropriate.
- Prettier for formatting.
- Node.js type definitions for configuration files where needed.

Do not install a second router, HTTP client, state manager, backend framework, blockchain SDK, or additional UI component library. Defer form libraries and other optional dependencies until a concrete feature needs them.

Check and record compatibility between MSW, the Socket.IO binding, and `socket.io-client`. Do not create a socket connection to prove compatibility in this task. If integration cannot be validated without a later protocol test, label that limitation explicitly.

## Project organization

Use a modest structure with clear extension points, for example:

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

Adapt filenames to the selected tooling. Avoid generating empty feature modules, repositories, services, hooks, or speculative abstractions. Explain future feature boundaries in documentation instead.

## Bootstrap wiring

### Routing and providers

- Use TanStack Router's code-based routing for this small bootstrap unless existing conventions require file-based routing.
- Register router types correctly.
- Create a root route, an index route, and a small not-found fallback.
- Wrap the app with a single stable TanStack Query client/provider.
- Configure a shared `@/` alias consistently for TypeScript, Vite, and shadcn.
- Keep React Strict Mode enabled.

### HTTP and environment

- Create one Axios instance with a validated base URL and finite timeout.
- Do not add auth interceptors, tokens, retries, API calls, or endpoint wrappers yet.
- Provide `.env.example` with a small documented set of public configuration values, such as:

```dotenv
VITE_API_BASE_URL=/api
VITE_ENABLE_MOCKS=true
```

- Parse booleans explicitly; the string `false` must not enable mocks.
- Explain that `VITE_*` values are public build-time configuration, not secrets.
- Do not add unused socket URLs or invented backend services.

### Mock infrastructure

- Generate the MSW worker using the installed MSW tooling.
- Export an empty handler array and a browser worker using it.
- Load mocks dynamically only when enabled by configuration.
- Await mock startup before rendering so future requests cannot race interception.
- Keep mock activation available in an optimized build; do not gate it solely on development mode.
- Do not add REST handlers, Socket.IO handlers, sample events, or domain fixtures yet.
- Ensure unhandled-request behavior does not break Vite, fonts, images, or static assets. Document the intended future API request policy.
- Do not silently suppress worker-startup failures.

### Styles and shadcn

- Initialize Tailwind and shadcn configuration with CSS variables and the shared alias.
- Keep component generation minimal; a component library showcase is not needed.
- Basic background, foreground, spacing, and readable system typography are sufficient.
- Do not reproduce the full KURIO theme, load remote fonts, or export Figma assets yet.

## Placeholder screen

Render a single accessible, responsive page with:

- Heading: `KURIO`
- Supporting text: `Frontend challenge — project setup complete.`
- Small note: `Marketplace features have not been implemented yet.`

Use a semantic `main` and one `h1`. Center a simple content block with comfortable padding. No buttons, menu, mock NFT cards, counters, wallet controls, or interactive product behavior.

Set the document title to `KURIO | Frontend Challenge`, a basic description, and an appropriate language attribute for the placeholder copy. Remove Vite demo logos, counters, and unused starter styles/assets.

The page must fit narrow viewports without horizontal overflow and must not issue REST requests or open Socket.IO connections.

## Tooling and commands

Provide working scripts equivalent to:

```text
dev                Start the development server
dev:mocks          Start development with mocks explicitly enabled
build              Type-check and produce the optimized build
preview            Serve the optimized build locally
typecheck          Check application and configuration types
lint               Run ESLint with no warnings allowed
format             Format maintained source/configuration files
format:check       Verify formatting
test:e2e           Run Playwright smoke tests
test:e2e:ui        Open Playwright's interactive runner
test:e2e:report    Open the HTML test report
audit:lighthouse  Run the configured Lighthouse checks
```

Ensure commands work on Windows and Unix-like environments. Do not use POSIX-only inline environment assignments; use a Vite mode/configuration or a small cross-platform helper where appropriate.

Exclude generated workers, build output, reports, and lockfiles from format/lint processing as appropriate. Ignore dependencies, local environment files, reports, traces, and build artifacts in Git; retain `.env.example` and the lockfile.

## Playwright setup

- Configure Chromium desktop and mobile viewport projects. Include 1440px desktop and 390px mobile widths.
- Use a managed local web server and deterministic base URL.
- Configure HTML reporting, screenshots on failure, and traces retained on failure.
- Add one smoke test that verifies the placeholder heading and copy, catches uncaught page errors, and checks for horizontal overflow.
- Keep the test isolated and independent of external services.
- Do not add future feature tests, skipped test inventories, or placeholder visual baselines.
- Document how to install the required browser binaries from a clean checkout.

## Lighthouse setup

- Configure auditing against the optimized local build, never the Vite development server.
- Make mobile and desktop profiles reproducible and retain HTML/JSON reports.
- Configure three runs per profile where supported; document that final reporting must use per-category medians.
- The only current audit target is `/`. NFT detail auditing is deferred until that route exists.
- Document the final challenge targets: performance 90, accessibility 95, best practices 95, SEO 90; record LCP, CLS, and TBT in the final implementation phase.
- Do not claim these targets have been met for the marketplace based on this placeholder.

## Vercel preparation only

- Configure the Vite build output and SPA fallback needed for direct-route access and refresh.
- Ensure the MSW worker and other static files remain directly accessible rather than being served as the HTML fallback.
- Document the intended demo environment variable enabling mocks.
- Do not create/link a Vercel project or deploy. No public URL is expected from this task.

## Documentation

Write a concise README covering prerequisites, installation, environment configuration, scripts, mock activation, browser installation, and local build/preview.

Write a short `ARCHITECTURE.md` explaining the current provider/router/HTTP/mock boundaries. Clearly distinguish installed tooling from implemented functionality. Record these future constraints without implementing them:

- URL-backed discovery state.
- User-scoped caches and session cleanup.
- Decimal-string ETH transport with precise arithmetic.
- API-authoritative quotes and idempotent order creation.
- Versioned Socket.IO events and REST reconciliation.
- Network-level mocks shared across development, demo, and tests.
- Desktop/mobile compositions sharing business logic.

In `docs/bootstrap-scope.md`, record completed setup, package/runtime choices, deferred protocol verification, and the explicit feature exclusions.

## Verification and stopping criteria

Before finishing:

1. Confirm dependencies install reproducibly with the committed lockfile.
2. Run type checking, lint, formatting checks, and the optimized build.
3. Run the Playwright placeholder smoke test in desktop and mobile projects.
4. Verify the placeholder starts with mocks enabled and disabled, with no startup errors.
5. Smoke-run the Lighthouse configuration against the optimized build and confirm report artifacts are generated. Label them bootstrap-only.
6. Confirm there are no application REST calls or Socket.IO connections, no business handlers, and no implemented marketplace features.
7. Confirm no deployment or remote repository mutation occurred.

If an environment restriction prevents installation or verification, report the exact command and limitation. Never claim an unexecuted check passed.

Return a concise summary of files/configuration added, installed package versions, checks run and their outcomes, and any remaining setup limitations. **Stop at the placeholder screen. Do not proceed to feature implementation.**
