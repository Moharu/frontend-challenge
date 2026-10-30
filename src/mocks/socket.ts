import { ws } from "msw";
import { toSocketIo } from "@mswjs/socket.io-binding";
import {
  authenticateEvent,
  type NftUpdated,
  type OrderUpdated,
} from "@/contracts/events";
import type { Order } from "@/contracts/orders";
import type { Session } from "@/contracts/session";
// Simulated Socket.IO server. Public events (`nft.updated`) go to every
// connection. Private events (`order.updated`) go only to connections
// authenticated as the order's owner: the client sends `session.authenticate`
// with its session token right after connecting and on every identity
// change (the binding does not expose the handshake `auth`, and has no acks).
// Anonymous connections and other users never receive another user's order.
export function createMockSocket(
  url: string,
  verify: (token: string) => Promise<Session | null>,
) {
  const link = ws.link(url);
  type Io = ReturnType<typeof toSocketIo>;
  const connections = new Map<Io, Session | null>();
  let interrupted = false;
  const handler = link.addEventListener("connection", (connection) => {
    if (interrupted) {
      connection.client.close(1012, "Scenario interruption");
      return;
    }
    const io = toSocketIo(connection);
    connections.set(io, null);
    // Each authentication replaces the previous one; a late answer for an
    // older request never overrides a newer one.
    let attempt = 0;
    io.client.on(authenticateEvent, (_event, payload: unknown) => {
      const current = ++attempt;
      const token =
        typeof payload === "object" &&
        payload !== null &&
        typeof (payload as { token?: unknown }).token === "string"
          ? (payload as { token: string }).token
          : null;
      connections.set(io, null);
      if (!token) return;
      void verify(token).then((session) => {
        if (current === attempt && connections.has(io))
          connections.set(io, session);
      });
    });
    // The binding supplies the opening handshake but no recurring Engine.IO ping.
    const heartbeat = setInterval(() => io.rawClient.send("2"), 25000);
    connection.client.addEventListener("close", () => {
      clearInterval(heartbeat);
      connections.delete(io);
    });
  });
  return {
    handler,
    emit(event: NftUpdated) {
      for (const io of connections.keys())
        io.client.emit("nft.updated", structuredClone(event));
    },
    // One envelope per owner connection, with that connection's session as
    // the audience; nothing is sent to anyone else.
    emitOrder(order: Order) {
      for (const [io, session] of connections) {
        if (!session || session.user.id !== order.userId) continue;
        const event: OrderUpdated = {
          type: "order.updated",
          eventId: `order-${order.id}-${order.version}`,
          resourceId: order.id,
          version: order.version,
          timestamp: order.updatedAt,
          payload: structuredClone(order),
          audience: {
            userId: order.userId,
            sessionId: session.id,
            sessionGeneration: session.generation,
          },
        };
        io.client.emit("order.updated", event);
      }
    },
    // Test-only: re-sends an envelope as is, to any connection of its owner.
    emitRaw(event: OrderUpdated) {
      for (const [io, session] of connections)
        if (session && session.user.id === event.audience.userId)
          io.client.emit("order.updated", structuredClone(event));
    },
    interrupt() {
      interrupted = true;
      for (const io of connections.keys())
        io.rawClient.close(1012, "Scenario interruption");
      connections.clear();
    },
    restore() {
      interrupted = false;
    },
    count: () => connections.size,
    authenticated: () =>
      [...connections.values()].filter(Boolean).map((s) => s!.user.id),
  };
}
