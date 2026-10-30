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
// The session is checked again before every private delivery: a connection
// whose session was revoked (password change, logout in another tab) or
// expired since it authenticated receives nothing and stops being
// authenticated until it authenticates again.
export function createMockSocket(
  url: string,
  verify: (token: string) => Promise<Session | null>,
) {
  const link = ws.link(url);
  type Io = ReturnType<typeof toSocketIo>;
  type Audience = { session: Session; token: string };
  const connections = new Map<Io, Audience | null>();
  // Private deliveries run one at a time, in emission order.
  let delivery = Promise.resolve();
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
          connections.set(io, session ? { session, token } : null);
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
      delivery = delivery
        .then(() => deliverOrder(structuredClone(order)))
        .catch(() => undefined);
    },
    // Test-only: re-sends an envelope as is, to any connection of its owner.
    emitRaw(event: OrderUpdated) {
      for (const [io, audience] of connections)
        if (audience && audience.session.user.id === event.audience.userId)
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
      [...connections.values()].filter(Boolean).map((a) => a!.session.user.id),
  };
  async function deliverOrder(order: Order) {
    for (const [io, audience] of [...connections]) {
      if (!audience || audience.session.user.id !== order.userId) continue;
      const current = await verify(audience.token);
      // The connection may have closed or re-authenticated meanwhile.
      if (connections.get(io) !== audience) continue;
      if (
        !current ||
        current.id !== audience.session.id ||
        current.generation !== audience.session.generation
      ) {
        connections.set(io, null);
        continue;
      }
      const event: OrderUpdated = {
        type: "order.updated",
        eventId: `order-${order.id}-${order.version}`,
        resourceId: order.id,
        version: order.version,
        timestamp: order.updatedAt,
        payload: structuredClone(order),
        audience: {
          userId: order.userId,
          sessionId: current.id,
          sessionGeneration: current.generation,
        },
      };
      io.client.emit("order.updated", event);
    }
  }
}
