# Architecture

`main.tsx` calls `readEnv()` inside its caught startup function to validate public environment settings, optionally awaits the dynamically imported MSW browser worker, then renders React Strict Mode. Startup failures are reported in the console and visibly in the root. The stable QueryClient is owned by `lib/query-client.ts`; `app/providers.tsx` mounts its provider once. No queries, mutations, cache policies, auth state, or subscriptions exist yet.

`app/router.tsx` defines code-based TanStack routes with registered types: a root outlet, `/` placeholder and unknown-route fallback. `@/` resolves to `src/` in TypeScript, Vite and shadcn configuration.

`lib/http.ts` exposes the single Axios instance with a 10-second timeout. Startup assigns its validated base URL before rendering consumers. Environment and HTTP module imports do not perform validation or throw configuration errors. It has no interceptors, tokens, endpoint wrappers or requests. `mocks/handlers.ts` is empty. The worker is available in demo builds through configuration and bypasses unhandled requests for now. Future API handlers must be shared across development, demo and tests; tighten unhandled API request checks when those handlers exist.

Tailwind uses its Vite plugin and CSS variables. The shadcn configuration and `cn` helper prepare component generation; no UI components or product theme are generated. Socket.IO client and its MSW binding are installed but not imported or connected. Playwright supplies smoke testing and future visual regression tooling without speculative baselines.

Future implementation must preserve these constraints:

- Discovery search, filters, ordering and pagination belong in the URL.
- Query caches and subscriptions must be scoped to the user and cleaned on session changes.
- Transport ETH values as decimal strings and use precise arithmetic.
- API quotes are authoritative; order creation must be idempotent.
- Socket.IO events require stable identity and versions; reconcile active resources through REST on reconnection and reject stale/duplicate/session-old events.
- Use network-level mocks across development, demo and tests, with deterministic shared state and reset scenarios.
- Desktop/mobile compositions share business logic.

No domain models, endpoints, fixtures, persistence, session system or business rules are defined at bootstrap. Cache/retry/session policies, contracts and transport protocol tests are deferred until feature work.

`tsconfig.tests.json` includes E2E test files with strict checking and DOM types for browser callbacks. The root project references it, so both `typecheck` and `build` check tests alongside application and tooling code.
