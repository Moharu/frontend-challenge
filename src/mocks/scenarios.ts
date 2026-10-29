import { delay } from "msw";
export type Scenario =
  "default" | "empty" | "http-error" | "network-error" | "out-of-order";
export type Failure = "http" | "network";
export function createScenarios() {
  let scenario: Scenario = "default";
  let delays: Record<string, number> = {};
  let failure: Failure | null = null;
  let generation = new AbortController();
  const stats = { started: 0, completed: 0, cancelled: 0 };
  return {
    stats,
    reset() {
      generation.abort();
      generation = new AbortController();
      scenario = "default";
      delays = {};
      failure = null;
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
    async before(request: Request) {
      stats.started++;
      const activeScenario = scenario;
      const currentFailure = failure;
      failure = null;
      const signal = generation.signal;
      const key = (new URL(request.url).searchParams.get("search") ?? "")
        .trim()
        .toLowerCase();
      const ms =
        delays[key] ??
        (activeScenario === "out-of-order" && key === "aurora" ? 300 : 0);
      try {
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
        stats.completed++;
        return {
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
