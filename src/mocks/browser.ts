import { setupWorker } from "msw/browser";
import { createStore, type MockStore } from "./store";
import { createHandlers } from "./handlers";
import { createScenarios } from "./scenarios";
import { createMockSocket } from "./socket";
import { apiURL, socketURL } from "@/lib/urls";
import type { NftUpdated, OrderUpdated } from "@/contracts/events";
import type { Order } from "@/contracts/orders";
import type { PaymentOutcome } from "./store/orders";
// The page timer resolves simulated payments when they are due. It runs only
// while an order is pending (armed for the earliest one), so idle pages do
// not reread the persisted state. Resolution does not depend on this timer
// alone: overdue orders are also resolved on start and on every order
// access, so a reload never loses one.
export async function startMocks(baseURL: string) {
  const base = apiURL(baseURL);
  const store: MockStore = createStore(localStorage);
  const scenarios = createScenarios();
  const socket = createMockSocket(socketURL(base), (token) =>
    store.session(token).catch(() => null),
  );
  let last: NftUpdated | null = null;
  let lastOrder: OrderUpdated | null = null;
  let generation = 0;
  const events = {
    nfts(list: NftUpdated[]) {
      for (const event of list) {
        last = event;
        socket.emit(event);
      }
    },
    orders(list: Order[]) {
      for (const order of list) {
        socket.emitOrder(order);
        lastOrder = {
          type: "order.updated",
          eventId: `order-${order.id}-${order.version}`,
          resourceId: order.id,
          version: order.version,
          timestamp: order.updatedAt,
          payload: structuredClone(order),
          audience: {
            userId: order.userId,
            sessionId: "",
            sessionGeneration: 1,
          },
        };
      }
    },
    pending() {
      void resolve().catch(() => undefined);
    },
  };
  const worker = setupWorker(
    ...createHandlers(base, store, scenarios, events),
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
  let timer = 0;
  async function resolve(force = false) {
    const result = await store.resolveDue(force);
    events.nfts(result.events);
    events.orders(result.orders);
    window.clearTimeout(timer);
    if (result.nextDue !== null)
      timer = window.setTimeout(
        () => void resolve().catch(() => undefined),
        Math.max(0, result.nextDue - Date.now()),
      );
    return result.orders;
  }
  // Overdue payments resolve on start, then when the next one is due.
  await resolve();
  // No timer-based catalog scheduler: mutations emit only after persistence.
  const controls = {
    store,
    scenarios,
    async reset() {
      generation++;
      socket.interrupt();
      scenarios.reset();
      await store.reset();
      last = null;
      lastOrder = null;
      socket.restore();
    },
    async update(
      id: string,
      editionId: string,
      patch: { priceEth?: string; available?: number; name?: string },
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
    // Simulated payment: outcome and delay of the next orders; resolving
    // pending orders now; losing the next order response.
    setPayment: (outcome: PaymentOutcome, delayMs?: number) =>
      store.setPayment(outcome, delayMs),
    resolvePayments: () => resolve(true),
    loseNextOrderResponse: scenarios.loseNextOrderResponse,
    // A catalog change (persisted and announced) right before the next order.
    changeBeforeNextOrder(
      id: string,
      editionId: string,
      patch: { priceEth?: string; available?: number },
    ) {
      scenarios.beforeNextOrder(() => controls.update(id, editionId, patch));
    },
    // Re-sends the last order event as is, or an older version of it.
    duplicateOrder() {
      if (!lastOrder) throw new Error("No previous order event");
      socket.emitOrder(lastOrder.payload);
    },
    staleOrder(patch: Partial<Order>) {
      if (!lastOrder) throw new Error("No previous order event");
      socket.emitOrder({ ...structuredClone(lastOrder.payload), ...patch });
    },
    interrupt: socket.interrupt,
    restore: socket.restore,
    connections: socket.count,
    authenticatedSockets: socket.authenticated,
  };
  return controls;
}
export type MockControls = Awaited<ReturnType<typeof startMocks>>;
