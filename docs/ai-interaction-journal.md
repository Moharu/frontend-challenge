# AI interaction and handoff journal

Maintain this high-level journal during future AI-assisted project work. Append dated entries with the user request, decisions and reasons, implementation scope, executed checks, human/manual observations, unresolved issues and handoff points. Distinguish automated browser checks from human visual verification; never claim an unperformed check. Create focused supporting documents in `docs` when needed.

## 2026-10-28 — Bootstrap requested

**User direction:** execute `coding-agent-bootstrap-draft.md`, maintain a high-level journal, and do not push code without explicit permission. The local initial README matches the challenge requirements supplied by the user.

**Scope:** initialize only the runnable placeholder and infrastructure. Do not open Figma, implement marketplace features, create remote repositories, deploy, or push. No commits are needed to complete this working-tree handoff; the lockfile is retained for a future commit.

**Inspection and decisions:** no existing app, package manager, lockfile or applicable AGENTS.md was found. Preserved the initial README verbatim as `docs/challenge-requirements.md` before writing setup instructions. Chose npm and the installed Node 24.22.0 LTS runtime, Vite, React, strict TypeScript, code-based TanStack Router and Tailwind's Vite integration. Applied the React best-practices skill for component review.

**Compatibility finding:** initial npm resolution selected MSW 3, conflicting with `@mswjs/socket.io-binding@0.2.0`'s peer requirement `msw@^2.10.2`. Selected MSW 2.15.0 instead without forcing peers. Socket.IO protocol integration remains deliberately untested; no connection is opened.

**Environment:** sandbox npm registry access failed with `EAI_AGAIN`; installation required network escalation. See bootstrap scope for final verification outcomes and resolved versions.

**Manual verification:** no human visual review has been reported. Automated browser checks and audit results are recorded separately after execution.

**Completed setup:** React/Vite/strict TypeScript, typed TanStack routing and Query provider, validated public configuration, inert Axios client, dynamically awaited empty MSW worker, neutral Tailwind styles and shadcn configuration, desktop/mobile Playwright smoke tests, local Lighthouse CI profiles, and Vercel configuration only. The verification skill was applied to startup, rendering and worker boundaries.

**Executed verification:** reproducible `npm ci`; types, build, lint and formatting passed. Desktop/mobile smoke tests passed with mocks disabled and enabled (four checks in total). Agent browser inspection confirmed worker control and script MIME delivery, unknown-route fallback and responsive screenshots. Six optimized-build Lighthouse runs produced local HTML/JSON reports; bootstrap-only results and versions are recorded in `bootstrap-scope.md`. No human visual verification was reported.

**Handoff:** latest Lighthouse CI has 16 dependency audit advisories in its tool chain; Socket.IO protocol integration is deferred. No feature implementation, commit, push or deployment occurred. Continue journaling future interactions, decisions and manual verification here. User authorization is still required before any push.

## 2026-10-28 — User verification

**User-reported results:** `npm run dev` works and displays the placeholder page. The user also ran `npm run test:e2e` and reported that all tests pass. These confirm local development startup and a user-run automated E2E check; no additional visual or feature verification is inferred.

## 2026-10-28 — Remove deprecated TypeScript configuration

**User report:** the IDE flags `baseUrl` as deprecated ahead of TypeScript 7. Removed it from both application and root TypeScript configurations and made the `@/*` mapping explicitly relative (`./src/*`). Official TypeScript documentation confirms that `paths` works relative to the configuration file without `baseUrl`. No warning suppression or dependency upgrade was needed; Vite's matching alias remains valid.

**Verification:** `npm run build` passed, including type checking with the project's TypeScript 5.9.3. Prettier checks passed for both modified configuration files. The IDE diagnostic itself was not directly inspected.

## 2026-10-28 — User architecture review

**Manual review:** the user reviewed `ARCHITECTURE.md` and the individual files referenced in it, and reported that all looked good. No changes were requested.

## 2026-10-28 — Bootstrap commit and push authorized

**User direction:** commit and push the reviewed bootstrap before proceeding. This authorizes the bootstrap push to `origin` (`Moharu/frontend-challenge`), on the current `main` branch. The challenge repository configured as `upstream` is not a push target. Future pushes still require user authorization.

**Pre-commit review:** the working tree contains the bootstrap source, tooling, lockfile and documentation; build output, dependencies, reports and local environment files are ignored. `git diff --check` passed. Prior build, lint, formatting and browser results are recorded above. Commit and push outcomes are reported in the accompanying chat and Git history.

## 2026-10-28 — Startup validation and E2E type checking

**Review findings:** confirmed both user-reported issues. Environment validation previously threw during static module evaluation, before the startup rejection handler could run. E2E test files were outside both TypeScript projects.

**Changes:** moved validation into `readEnv()`, called inside `start()`. Startup assigns the validated base URL to the shared Axios instance before rendering; neither module validates at import time. Added a root-referenced `tsconfig.tests.json` inheriting strict tooling settings with DOM libraries and including `tests/**/*.ts`. Updated architecture documentation.

**Verification:** build (including application, tooling and test type checking), lint, and desktop/mobile E2E smoke tests passed. An agent-run Chromium check confirmed malformed API URLs and invalid mock flags display the startup error message, log the caught failure and produce no uncaught page errors; valid settings render the placeholder. A temporary deliberate type error in `tests/` was detected by the root typecheck; after removing the probe, type checking passed. No human review of these changes is claimed. No commit or push was performed for this follow-up.

**Commit authorization:** the user subsequently approved committing and pushing these fixes to `origin/main`. The commit includes the startup validation fix, test TypeScript project and accompanying documentation. Outcomes are reported in chat and Git history.
