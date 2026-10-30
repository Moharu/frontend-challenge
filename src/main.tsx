import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { Providers } from "@/app/providers";
import { router } from "@/app/router";
import { readEnv } from "@/lib/env";
import { http } from "@/lib/http";
import { verifySession } from "@/data/session/identity";
import "@/styles/globals.css";
class ServiceWorkerUnavailable extends Error {}
// MSW's worker unregisters itself when its last page unloads (reload or full
// navigation). The next page may still be controlled by that old worker,
// which knows no active page and lets every request through to the network
// (a 404 on the published site), while MSW activates a new worker. That one
// claims the open pages on activation: wait for it (briefly) before
// rendering. A first visit (no controller yet) waits the same way.
async function controlledByActiveWorker() {
  const registration = await navigator.serviceWorker.ready;
  const controlled = () =>
    !!registration.active &&
    navigator.serviceWorker.controller === registration.active;
  if (controlled()) return;
  await new Promise<void>((resolve) => {
    const check = () => {
      if (!controlled()) return;
      navigator.serviceWorker.removeEventListener("controllerchange", check);
      resolve();
    };
    navigator.serviceWorker.addEventListener("controllerchange", check);
    setTimeout(() => {
      navigator.serviceWorker.removeEventListener("controllerchange", check);
      resolve();
    }, 3000);
  });
}
async function start() {
  const env = readEnv();
  http.defaults.baseURL = env.apiBaseURL;
  if (env.enableMocks) {
    // The demonstration's API lives in a service worker (MSW): without one
    // (old browser, blocked, or a non-secure origin), the interface does not
    // start and says why.
    if (!("serviceWorker" in navigator) || !window.isSecureContext)
      throw new ServiceWorkerUnavailable();
    const { startMocks } = await import("@/mocks/browser");
    const controls = await startMocks(env.apiBaseURL);
    await controlledByActiveWorker();
    if (import.meta.env.VITE_ENABLE_TEST_HARNESS === "true") {
      const { installHarness } = await import("@/testing/harness");
      installHarness(controls, env.apiBaseURL);
      if (window.location.pathname === "/__protocol") return;
    }
  }
  // A stored session is verified in the background; public pages never wait.
  void verifySession();
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </StrictMode>,
  );
}
// Startup failure: a clear message instead of a blank page. The simulated
// API depends on the service worker, the usual cause.
void start().catch((error: unknown) => {
  console.error("Application startup failed", error);
  const workerProblem =
    error instanceof ServiceWorkerUnavailable ||
    /service ?worker/i.test(String(error));
  const root = document.getElementById("root")!;
  const box = document.createElement("main");
  box.className = "startup-error";
  box.setAttribute("role", "alert");
  const title = document.createElement("h1");
  title.textContent = "Não foi possível iniciar a demonstração";
  const text = document.createElement("p");
  text.textContent = workerProblem
    ? "Esta demonstração simula a API dentro do navegador com um service worker, e ele não pôde ser ativado. Use um navegador atualizado, sem bloqueio de service workers (por exemplo, fora da navegação privada de alguns navegadores), e recarregue a página."
    : "Ocorreu um erro ao carregar a aplicação. Recarregue a página para tentar de novo.";
  box.append(title, text);
  root.replaceChildren(box);
});
