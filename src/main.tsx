import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { Providers } from "@/app/providers";
import { router } from "@/app/router";
import { readEnv } from "@/lib/env";
import { http } from "@/lib/http";
import "@/styles/globals.css";
async function start() {
  const env = readEnv();
  http.defaults.baseURL = env.apiBaseURL;
  if (env.enableMocks) {
    const { startMocks } = await import("@/mocks/browser");
    const controls = await startMocks(env.apiBaseURL);
    if (import.meta.env.VITE_ENABLE_TEST_HARNESS === "true") {
      const { installHarness } = await import("@/testing/harness");
      installHarness(controls, env.apiBaseURL);
      if (window.location.pathname === "/__protocol") return;
    }
  }
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </StrictMode>,
  );
}
void start().catch((error: unknown) => {
  console.error("Application startup failed", error);
  document.getElementById("root")!.textContent =
    "Application setup failed. Check the browser console.";
});
