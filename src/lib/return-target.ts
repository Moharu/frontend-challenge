import { useRouterState } from "@tanstack/react-router";
import { safeRedirect } from "./redirect";
// Return target for "Entrar": the current page, except on the auth routes.
export function useReturnTarget() {
  return useRouterState({
    select: (state) =>
      safeRedirect(
        ["/login", "/signup"].includes(state.location.pathname)
          ? undefined
          : state.location.href,
      ),
  });
}
