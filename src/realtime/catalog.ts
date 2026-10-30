import { io } from "socket.io-client";
import type { QueryClient } from "@tanstack/react-query";
import { record, type DataResponse } from "@/contracts/common";
import type { Nft } from "@/contracts/nfts";
import { authenticateEvent, isNftUpdated } from "@/contracts/events";
import { nftKeys } from "@/data/nfts/queries";
import type { Cart } from "@/contracts/cart";
import { apiURL } from "@/lib/urls";
export function createCatalogRealtime(
  queryClient: QueryClient,
  baseURL: string,
) {
  const url = new URL(apiURL(baseURL));
  const socket = io(url.origin, {
    path: `${url.pathname.replace(/\/$/, "")}/socket.io/`,
    transports: ["websocket"],
    autoConnect: false,
    forceNew: true,
    reconnection: true,
    reconnectionDelay: 100,
    reconnectionDelayMax: 500,
    randomizationFactor: 0,
    timeout: 3000,
  });
  const versions = new Map<string, number>();
  const seen = new Set<string>();
  let disposed = false;
  const stats = {
    applied: 0,
    ignored: 0,
    invalid: 0,
    connections: 0,
    reconciliations: 0,
    lastError: null as string | null,
  };
  let work = Promise.resolve();
  function reconcile() {
    stats.connections++;
    work = work
      .then(async () => {
        if (disposed) return;
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: nftKeys.details(),
            refetchType: "active",
          }),
          queryClient.invalidateQueries({
            queryKey: nftKeys.lists(),
            refetchType: "active",
          }),
        ]);
        await queryClient.invalidateQueries({
          queryKey: ["nfts", "related"],
          refetchType: "active",
        });
        // Private data the socket may have missed while disconnected
        // (cart, the order being followed) is reconciled by REST; lost events
        // are never relied on.
        await queryClient.invalidateQueries({
          queryKey: ["cart"],
          refetchType: "active",
        });
        await queryClient.invalidateQueries({
          queryKey: ["order"],
          refetchType: "active",
        });
        stats.reconciliations++;
      })
      .catch((e) => {
        stats.lastError = String(e);
      });
  }
  function event(value: unknown) {
    if (!isNftUpdated(value)) {
      stats.invalid++;
      return;
    }
    // Only previously received events participate in deduplication. A fresh
    // detail cache must not hide an event from older list caches.
    const processedVersion = versions.get(value.resourceId) ?? 0;
    if (seen.has(value.eventId) || value.version <= processedVersion) {
      stats.ignored++;
      return;
    }
    seen.add(value.eventId);
    if (seen.size > 1000) seen.delete(seen.values().next().value!);
    versions.set(value.resourceId, value.version);
    // Cancel in-flight detail responses before writing event state; lists refetch membership.
    work = work
      .then(async () => {
        if (disposed) return;
        const key = nftKeys.detail(value.resourceId);
        const cached = queryClient.getQueryData<DataResponse<Nft>>(key);
        if (!cached || cached.data.version < value.version) {
          await queryClient.cancelQueries({ queryKey: key });
          if (disposed) return;
          const current = queryClient.getQueryData<DataResponse<Nft>>(key);
          if (!current || current.data.version < value.version)
            queryClient.setQueryData(key, { data: value.payload });
        }
        await queryClient.invalidateQueries({
          queryKey: nftKeys.lists(),
          refetchType: "active",
        });
        await queryClient.invalidateQueries({
          queryKey: ["nfts", "related"],
          refetchType: "active",
        });
        // Cart values come from the API: refetch instead of recalculating.
        const inCart = queryClient
          .getQueriesData<Cart | null>({ queryKey: ["cart"] })
          .some(([, cart]) =>
            cart?.items.some((i) => i.nftId === value.resourceId),
          );
        if (inCart)
          await queryClient.invalidateQueries({
            queryKey: ["cart"],
            refetchType: "active",
          });
        stats.applied++;
      })
      .catch((e) => {
        stats.lastError = String(e);
      });
  }
  // The connection authenticates as the current session (token) right after
  // connecting and on every identity change, so the server sends private
  // events only to their owner. Logout sends a null token.
  type Audience = { userId: string; generation: number; token: string };
  let identity: Audience | null = null;
  const authenticate = () => {
    if (socket.connected)
      socket.emit(authenticateEvent, { token: identity?.token ?? null });
  };
  socket.on("connect", authenticate);
  socket.on("connect", reconcile);
  socket.on("nft.updated", event);
  // Private events share this connection. Their listeners belong to one
  // identity: changing it (login, logout, expiry, user switch) releases them,
  // and an envelope addressed to another user or session generation is
  // ignored (defense in depth: the server already sends them only to the
  // owner).
  const privateListeners = new Map<string, (value: unknown) => void>();
  function releasePrivate() {
    privateListeners.forEach((listener, name) => socket.off(name, listener));
    privateListeners.clear();
  }
  return {
    stats,
    socket,
    setIdentity(next: Audience | null) {
      if (JSON.stringify(next) === JSON.stringify(identity)) return;
      releasePrivate();
      identity = next;
      authenticate();
    },
    onPrivate(name: string, handler: (value: unknown) => void) {
      if (!identity) throw new Error("Private listener without a session");
      const owner = identity;
      const listener = (value: unknown) => {
        const audience = record(value) ? value.audience : undefined;
        if (
          identity !== owner ||
          !record(audience) ||
          audience.userId !== owner.userId ||
          audience.sessionGeneration !== owner.generation
        ) {
          stats.ignored++;
          return;
        }
        handler(value);
      };
      const previous = privateListeners.get(name);
      if (previous) socket.off(name, previous);
      privateListeners.set(name, listener);
      socket.on(name, listener);
    },
    privateListenerCount: () => privateListeners.size,
    connect() {
      if (disposed) throw new Error("Disposed realtime client");
      socket.connect();
    },
    disconnect() {
      socket.disconnect();
    },
    async settled() {
      await work;
    },
    dispose() {
      disposed = true;
      socket.off("connect", reconcile);
      socket.off("connect", authenticate);
      socket.off("nft.updated", event);
      releasePrivate();
      socket.disconnect();
      versions.clear();
      seen.clear();
    },
  };
}
export type CatalogRealtime = ReturnType<typeof createCatalogRealtime>;
