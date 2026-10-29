// Return-to-flow target carried in the `redirect` search param. Only internal
// paths of known routes are accepted (with their search and hash), so the
// login can never send the user to another site (open redirect).
const origin = "https://kurio.invalid";
const knownRoutes = [
  /^\/$/,
  /^\/cart$/,
  /^\/nfts\/[^/]+$/,
  // Integration-only protected route (see app/router.tsx).
  ...(import.meta.env.VITE_ENABLE_TEST_HARNESS === "true"
    ? [/^\/__private$/]
    : []),
];
export const fallbackRedirect = "/";
export function safeRedirect(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    [...value].some((char) => char.charCodeAt(0) < 32)
  )
    return fallbackRedirect;
  let url: URL;
  try {
    url = new URL(value, origin);
  } catch {
    return fallbackRedirect;
  }
  if (
    url.origin !== origin ||
    !knownRoutes.some((route) => route.test(url.pathname))
  )
    return fallbackRedirect;
  return `${url.pathname}${url.search}${url.hash}`;
}
export const authSearch = (input: Record<string, unknown>) => ({
  redirect: safeRedirect(input.redirect),
});
declare module "@tanstack/history" {
  interface HistoryState {
    // Auth dialog open over the current page (see `authLink`).
    auth?: "login" | "signup";
    // Validated page behind the dialog, where it returns.
    authTarget?: string;
  }
}
// History entry this document loaded on (TanStack's `__TSR_index`), read
// eagerly at startup. An auth dialog on this entry was restored by a reload
// (or direct visit), so the entry before it belongs to an earlier load.
type EntryState = {
  __TSR_index?: number;
  auth?: string;
  __tempLocation?: { state?: { auth?: string } };
} | null;
const loadedState =
  typeof window === "undefined" ? null : (window.history.state as EntryState);
export const loadedEntry: unknown = loadedState?.__TSR_index;
// Loaded (by a reload) with the auth dialog open: the browser's own scroll
// restoration is blocked while the dialog locks scrolling and would jump to
// the old position once it closes. A refreshed page starts at the top, so
// the browser restoration is switched off until the dialog closes.
export const openedOnLoad = Boolean(
  loadedState?.auth || loadedState?.__tempLocation?.state?.auth,
);
if (openedOnLoad) {
  window.history.scrollRestoration = "manual";
  // Mobile: cover the page from the first frame until the full-screen dialog
  // mounts (removed by `dialogShown`), so the page never flashes behind it.
  document.documentElement.classList.add("auth-restoring");
}
export const dialogShown = () => {
  if (typeof document !== "undefined")
    document.documentElement.classList.remove("auth-restoring");
};
export const resumeScrollRestoration = () => {
  if (typeof window !== "undefined") window.history.scrollRestoration = "auto";
};
// Navigation options for a validated target, with explicit search and hash:
// `navigate({ href })` back to the page already shown drops the hash.
export function targetLocation(target: string) {
  const url = new URL(safeRedirect(target), origin);
  return {
    to: url.pathname,
    search: Object.fromEntries(url.searchParams),
    hash: url.hash.replace(/^#/, ""),
    // Returning to (or opening over) a live page keeps where the user was.
    resetScroll: false,
  };
}
// Link/navigate options that open the auth dialog over the page at `target`
// without leaving it: the router stays on the page (flagged in history state)
// while the address bar shows the masked /login or /signup URL. A reload of
// that URL loads the real auth route.
export function authLink(mode: "login" | "signup", target: string) {
  return {
    ...targetLocation(target),
    state: { auth: mode, authTarget: safeRedirect(target) },
    mask: { to: `/${mode}` as const, search: { redirect: target } },
  } as const;
}
