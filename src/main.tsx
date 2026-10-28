import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { Providers } from "@/app/providers";
import { router } from "@/app/router";
import { env } from "@/lib/env";
import "@/styles/globals.css";
async function start() {
  if (env.enableMocks) {
    const { worker } = await import("@/mocks/browser");
    await worker.start({ onUnhandledRequest: "bypass" });
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
