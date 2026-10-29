import { io } from "socket.io-client";
import type { QueryClient } from "@tanstack/react-query";
import type { DataResponse } from "@/contracts/common";
import type { Nft } from "@/contracts/nfts";
import { isNftUpdated } from "@/contracts/events";
import { nftKeys } from "@/data/nfts/queries";
import { cartKey } from "@/data/cart/queries";
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
        await queryClient.invalidateQueries({
          queryKey: cartKey,
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
        const cart = queryClient.getQueryData<Cart | null>(cartKey);
        if (cart?.items.some((i) => i.nftId === value.resourceId))
          await queryClient.invalidateQueries({
            queryKey: cartKey,
            refetchType: "active",
          });
        stats.applied++;
      })
      .catch((e) => {
        stats.lastError = String(e);
      });
  }
  socket.on("connect", reconcile);
  socket.on("nft.updated", event);
  return {
    stats,
    socket,
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
      socket.off("nft.updated", event);
      socket.disconnect();
      versions.clear();
      seen.clear();
    },
  };
}
export type CatalogRealtime = ReturnType<typeof createCatalogRealtime>;
