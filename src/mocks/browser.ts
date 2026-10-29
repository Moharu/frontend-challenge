import { setupWorker } from "msw/browser";
import { createStore } from "./store";
import { createHandlers } from "./handlers";
import { createScenarios } from "./scenarios";
import { createMockSocket } from "./socket";
import { apiURL, socketURL } from "@/lib/urls";
import type { NftUpdated } from "@/contracts/events";
export async function startMocks(baseURL: string) {
  const base = apiURL(baseURL);
  const store = createStore(localStorage);
  const scenarios = createScenarios();
  const socket = createMockSocket(socketURL(base));
  const worker = setupWorker(
    ...createHandlers(base, store, scenarios),
    socket.handler,
  );
  await worker.start({
    onUnhandledRequest(request, print) {
      const url = new URL(request.url);
      if (
        url.origin === new URL(base).origin &&
        (url.pathname === new URL(base).pathname ||
          url.pathname.startsWith(new URL(base).pathname + "/"))
      )
        print.error();
    },
  });
  let last: NftUpdated | null = null;
  let generation = 0;
  // No timer-based event scheduler: mutations emit only after persistence completes.
  const controls = {
    store,
    scenarios,
    async reset() {
      generation++;
      socket.interrupt();
      scenarios.reset();
      await store.reset();
      last = null;
      socket.restore();
    },
    async update(
      id: string,
      editionId: string,
      patch: { priceEth?: string; available?: number },
    ) {
      const currentGeneration = generation;
      const event = await store.update(id, editionId, patch);
      if (currentGeneration === generation) {
        last = event;
        socket.emit(event);
      }
      return event;
    },
    replay(event: NftUpdated) {
      socket.emit(event);
    },
    duplicate() {
      if (!last) throw new Error("No previous event");
      socket.emit(last);
    },
    older() {
      if (!last || last.version < 2) throw new Error("No previous version");
      const old = structuredClone(last);
      old.version--;
      old.payload.version--;
      old.eventId = `historical-${old.eventId}`;
      socket.emit(old);
    },
    interrupt: socket.interrupt,
    restore: socket.restore,
    connections: socket.count,
  };
  return controls;
}
export type MockControls = Awaited<ReturnType<typeof startMocks>>;
