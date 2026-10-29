import { ws } from "msw";
import { toSocketIo } from "@mswjs/socket.io-binding";
import type { NftUpdated } from "@/contracts/events";
export function createMockSocket(url: string) {
  const link = ws.link(url);
  const connections = new Set<ReturnType<typeof toSocketIo>>();
  let interrupted = false;
  const handler = link.addEventListener("connection", (connection) => {
    if (interrupted) {
      connection.client.close(1012, "Scenario interruption");
      return;
    }
    const io = toSocketIo(connection);
    connections.add(io);
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
      for (const io of connections)
        io.client.emit("nft.updated", structuredClone(event));
    },
    interrupt() {
      interrupted = true;
      for (const io of connections)
        io.rawClient.close(1012, "Scenario interruption");
      connections.clear();
    },
    restore() {
      interrupted = false;
    },
    count: () => connections.size,
  };
}
