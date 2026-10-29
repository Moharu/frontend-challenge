import { delay } from "msw";
export type Scenario =
  "default" | "empty" | "http-error" | "network-error" | "out-of-order";
export type Failure = "http" | "network";
// Session check failures must survive the reload that runs the first
// `GET /session`, so (unlike the other controls) they live in sessionStorage.
const sessionFailuresKey = "kurio.mock.session-failures";
function sessionFailures(): { kind: Failure; count: number } | null {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(sessionFailuresKey) ?? "null",
    ) as { kind: Failure; count: number } | null;
    return value && value.count > 0 ? value : null;
  } catch {
    return null;
  }
}
function storeSessionFailures(value: { kind: Failure; count: number } | null) {
  try {
    if (value && value.count > 0)
      sessionStorage.setItem(sessionFailuresKey, JSON.stringify(value));
    else sessionStorage.removeItem(sessionFailuresKey);
  } catch {
    // Storage unavailable: the control simply has no effect.
  }
}
export function createScenarios() {
  let scenario: Scenario = "default";
  let delays: Record<string, number> = {};
  let failure: Failure | null = null;
  // Cart controls: one-shot failures and delays for cart reads/writes, kept apart
  // from catalog requests that run concurrently on the same page.
  let cartFailures: Record<"read" | "write", Failure | null> = {
    read: null,
    write: null,
  };
  let cartDelays = { read: 0, write: 0 };
  // Checkout controls: one-shot failures and latency for quotes and wallet
  // connections (a connection answers after a short, realistic latency), plus
  // a one-shot rejection of the next connection.
  type CheckoutKey = "quote" | "connection";
  const defaultCheckoutDelays = { quote: 0, connection: 300 };
  let checkoutFailures: Record<CheckoutKey, Failure | null> = {
    quote: null,
    connection: null,
  };
  let checkoutDelays = { ...defaultCheckoutDelays };
  let rejectConnection = false;
  let generation = new AbortController();
  const stats = { started: 0, completed: 0, cancelled: 0 };
  // Abortable wait shared by request delays and cart response latency; aborts
  // with the request or on reset (generation change).
  async function pause(ms: number, request: Request) {
    const signal = generation.signal;
    if (request.signal.aborted || signal.aborted)
      throw new DOMException("Aborted", "AbortError");
    await new Promise<void>((resolve, reject) => {
      const abort = () => {
        cleanup();
        reject(new DOMException("Aborted", "AbortError"));
      };
      const cleanup = () => {
        request.signal.removeEventListener("abort", abort);
        signal.removeEventListener("abort", abort);
      };
      request.signal.addEventListener("abort", abort, { once: true });
      signal.addEventListener("abort", abort, { once: true });
      void delay(ms).then(() => {
        cleanup();
        resolve();
      });
    });
  }
  return {
    stats,
    reset() {
      generation.abort();
      generation = new AbortController();
      scenario = "default";
      delays = {};
      failure = null;
      cartFailures = { read: null, write: null };
      cartDelays = { read: 0, write: 0 };
      storeSessionFailures(null);
      checkoutFailures = { quote: null, connection: null };
      checkoutDelays = { ...defaultCheckoutDelays };
      rejectConnection = false;
      stats.started = 0;
      stats.completed = 0;
      stats.cancelled = 0;
    },
    select(value: Scenario) {
      if (
        ![
          "default",
          "empty",
          "http-error",
          "network-error",
          "out-of-order",
        ].includes(value)
      )
        throw new Error("Unknown scenario");
      scenario = value;
    },
    setDelay(key: string, ms: number) {
      if (!Number.isSafeInteger(ms) || ms < 0 || ms > 10000)
        throw new Error("Delay must be 0..10000 ms");
      delays[key.trim().toLowerCase()] = ms;
    },
    failNext(kind: Failure) {
      if (kind !== "http" && kind !== "network")
        throw new Error("Invalid failure");
      failure = kind;
    },
    failNextCart(kind: Failure, operation: "read" | "write") {
      if (kind !== "http" && kind !== "network")
        throw new Error("Invalid failure");
      cartFailures[operation] = kind;
    },
    // The next `count` session checks (`GET /session`) fail, across reloads.
    failSessionChecks(kind: Failure, count: number) {
      if (kind !== "http" && kind !== "network")
        throw new Error("Invalid failure");
      if (!Number.isSafeInteger(count) || count < 0 || count > 10)
        throw new Error("Count must be 0..10");
      storeSessionFailures({ kind, count });
    },
    failNextCheckout(kind: Failure, key: CheckoutKey) {
      if (kind !== "http" && kind !== "network")
        throw new Error("Invalid failure");
      checkoutFailures[key] = kind;
    },
    setCheckoutDelay(key: CheckoutKey, ms: number) {
      if (!Number.isSafeInteger(ms) || ms < 0 || ms > 10000)
        throw new Error("Delay must be 0..10000 ms");
      checkoutDelays[key] = ms;
    },
    rejectNextConnection() {
      rejectConnection = true;
    },
    // Consumed by the connection handler after the request is accepted.
    takeConnectionRejection() {
      const value = rejectConnection;
      rejectConnection = false;
      return value;
    },
    setCartDelay(kind: "read" | "write", ms: number) {
      if (!Number.isSafeInteger(ms) || ms < 0 || ms > 10000)
        throw new Error("Delay must be 0..10000 ms");
      cartDelays[kind] = ms;
    },
    pause,
    async before(request: Request) {
      stats.started++;
      const activeScenario = scenario;
      const url = new URL(request.url);
      const mutation = request.method !== "GET";
      const cart = /\/(cart|visitor-sessions)(\/|$)/.test(url.pathname);
      let currentFailure = failure;
      failure = null;
      const operation = mutation ? "write" : "read";
      if (cart && cartFailures[operation]) {
        currentFailure = cartFailures[operation];
        cartFailures[operation] = null;
      }
      const sessionCheck = /\/session$/.test(url.pathname) && !mutation;
      const pendingSession = sessionCheck ? sessionFailures() : null;
      if (pendingSession) {
        currentFailure = pendingSession.kind;
        storeSessionFailures({
          ...pendingSession,
          count: pendingSession.count - 1,
        });
      }
      const checkout: CheckoutKey | null = /\/quotes$/.test(url.pathname)
        ? "quote"
        : /\/wallet-connections$/.test(url.pathname) && mutation
          ? "connection"
          : null;
      if (checkout && checkoutFailures[checkout]) {
        currentFailure = checkoutFailures[checkout];
        checkoutFailures[checkout] = null;
      }
      const key = (url.searchParams.get("search") ?? "").trim().toLowerCase();
      // Cart reads model response latency: the state is read first and the
      // response is delayed afterwards, so a slow read can carry older state.
      const cartRead = cart && !mutation;
      const ms = checkout
        ? checkoutDelays[checkout]
        : cart
          ? mutation
            ? cartDelays.write
            : 0
          : (delays[key] ??
            (activeScenario === "out-of-order" && key === "emerald" ? 300 : 0));
      try {
        await pause(ms, request);
        stats.completed++;
        return {
          responseDelay: cartRead ? cartDelays.read : 0,
          empty: activeScenario === "empty",
          failure:
            currentFailure ??
            (activeScenario === "http-error"
              ? "http"
              : activeScenario === "network-error"
                ? "network"
                : null),
        };
      } catch (error) {
        stats.cancelled++;
        throw error;
      }
    },
  };
}
export type ScenarioControls = ReturnType<typeof createScenarios>;
