import { isNft, type Nft } from "@/contracts/nfts";
import { record, integer } from "@/contracts/common";
import { baseline, seedNfts } from "./seed";
import type { NftUpdated } from "@/contracts/events";
export const storageKey = "kurio.mock.catalog.v1";
export interface Snapshot {
  schemaVersion: 1;
  seedVersion: 1;
  tick: number;
  nfts: Nft[];
}
function fresh(): Snapshot {
  return { schemaVersion: 1, seedVersion: 1, tick: 0, nfts: seedNfts() };
}
function valid(value: unknown): value is Snapshot {
  if (
    !record(value) ||
    value.schemaVersion !== 1 ||
    value.seedVersion !== 1 ||
    !integer(value.tick) ||
    value.tick > 1000000
  )
    return false;
  const nfts = value.nfts;
  return (
    Array.isArray(nfts) &&
    nfts.length === 24 &&
    nfts.every(isNft) &&
    new Set(nfts.map((n) => n.id)).size === 24 &&
    seedNfts().every((seed) => nfts.some((n) => n.id === seed.id))
  );
}
export function createStore(storage: Storage) {
  let state: Snapshot;
  let queue = Promise.resolve();
  function persist(next: Snapshot) {
    storage.setItem(storageKey, JSON.stringify(next));
    state = next;
  }
  function initialize() {
    let candidate: unknown;
    try {
      const raw = storage.getItem(storageKey);
      candidate = raw ? JSON.parse(raw) : null;
    } catch {
      candidate = null;
    }
    if (valid(candidate)) state = candidate;
    else persist(fresh());
  }
  initialize();
  function transaction<T>(work: () => T): Promise<T> {
    const result = queue.then(work);
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
  return {
    snapshot: () => structuredClone(state),
    reset: () =>
      transaction(() => {
        persist(fresh());
      }),
    update: (
      id: string,
      editionId: string,
      patch: { priceEth?: string; available?: number },
    ) =>
      transaction((): NftUpdated => {
        const next = structuredClone(state);
        const nft = next.nfts.find((n) => n.id === id);
        const edition = nft?.editions.find((e) => e.id === editionId);
        if (!nft || !edition) throw new Error("Unknown NFT or edition");
        if (
          Object.keys(patch).some(
            (key) => key !== "priceEth" && key !== "available",
          )
        )
          throw new Error("Unknown update field");
        if ("priceEth" in patch) edition.priceEth = patch.priceEth!;
        if ("available" in patch) edition.available = patch.available!;
        next.tick++;
        nft.version++;
        nft.updatedAt = new Date(
          Date.parse(baseline) + next.tick * 1000,
        ).toISOString();
        if (!isNft(nft)) throw new Error("Invalid NFT update");
        persist(next);
        return {
          type: "nft.updated",
          eventId: `catalog-${next.tick}`,
          resourceId: id,
          version: nft.version,
          timestamp: nft.updatedAt,
          payload: structuredClone(nft),
        };
      }),
  };
}
export type MockStore = ReturnType<typeof createStore>;
