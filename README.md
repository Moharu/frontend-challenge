# KURIO frontend challenge

Bootstrap only: an accessible placeholder, tooling, and infrastructure. Marketplace features are not implemented. The original requirements are preserved in [docs/challenge-requirements.md](docs/challenge-requirements.md).

Use Node 24.22.0 (`nvm use`) and npm 11.

```sh
npm ci
cp .env.example .env.local
npx playwright install chromium
npm run dev
```

On Windows copy `.env.example` to `.env.local` using your shell or editor. If Chromium needs OS libraries on Linux, run `npx playwright install --with-deps chromium` with the required system permissions.

| Script                            | Purpose                                                  |
| --------------------------------- | -------------------------------------------------------- |
| `dev`                             | Development server                                       |
| `dev:mocks`                       | Development with mocks enabled via Vite's mocks mode     |
| `build`                           | Type check and optimized build                           |
| `preview`                         | Serve the build locally                                  |
| `typecheck`                       | Application and configuration types                      |
| `lint`                            | ESLint, zero warnings                                    |
| `format` / `format:check`         | Format / check maintained files                          |
| `test:e2e`                        | Chromium desktop (1440px) and mobile (390px) smoke tests |
| `test:e2e:ui` / `test:e2e:report` | Interactive runner / HTML report                         |
| `audit:lighthouse`                | Three optimized-build runs per mobile/desktop profile    |

`npm run build` must precede E2E tests and Lighthouse. Tests manage their own preview server. To verify optimized mock startup, use `npm run build -- --mode mocks`, then `npm run test:e2e`. Build normally again to test the default disabled configuration.

`VITE_API_BASE_URL` defaults to `/api`; use a root-relative path or absolute HTTP(S) URL. `VITE_ENABLE_MOCKS` accepts exactly `true` or `false` and defaults to `false`. All `VITE_*` settings are public build-time values, never secrets. `.env.local` or process environment overrides mode defaults; keep it absent or consistent when testing modes. For the future Vercel demo, set `VITE_ENABLE_MOCKS=true` before building.

Mocks are dynamically loaded and awaited before rendering, including in optimized builds. The generated worker is checked in; regenerate after MSW updates with `npx msw init public --save`. There are no handlers or API calls yet. Unhandled requests currently bypass interception so static resources continue loading. The future policy should fail unhandled requests to the configured API while allowing assets and external resources explicitly.

Lighthouse writes HTML/JSON to `reports/lighthouse/{mobile,desktop}`. These ignored artifacts describe the **bootstrap placeholder only**. Final reporting must use each category's median across three runs, not a representative run's scores. Marketplace targets: performance 90, accessibility 95, best practices 95, SEO 90; record LCP, CLS and TBT for home and NFT detail after implementation. The current only target is `/`.

`vercel.json` prepares Vite output and filesystem-first SPA fallback, keeping `/mockServiceWorker.js` and assets accessible. No Vercel project is linked and no deployment is performed.

See [ARCHITECTURE.md](ARCHITECTURE.md), [bootstrap scope](docs/bootstrap-scope.md), and the ongoing [handoff journal](docs/ai-interaction-journal.md).
