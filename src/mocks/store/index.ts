import { isNft, type Nft } from "@/contracts/nfts";
import { record, integer } from "@/contracts/common";
import { seedNfts } from "./seed";
import type { NftUpdated } from "@/contracts/events";
import {
  addItem,
  applyCoupon,
  cartFor,
  changeItem,
  createVisitor,
  logicalTime,
  removeCoupon,
  removeItem,
  viewCart,
  type CommerceState,
  type StoredCart,
} from "./cart";
export const storageKey = "kurio.mock.catalog.v1";
export interface Snapshot extends CommerceState {
  schemaVersion: 3;
  seedVersion: 2;
  tick: number;
  nfts: Nft[];
}
function fresh(): Snapshot {
  return {
    schemaVersion: 3,
    seedVersion: 2,
    tick: 0,
    nfts: seedNfts(),
    visitors: {},
    carts: {},
  };
}
function validCart(value: unknown): value is StoredCart {
  return (
    record(value) &&
    typeof value.id === "string" &&
    integer(value.version, 1) &&
    (value.coupon === null || typeof value.coupon === "string") &&
    typeof value.updatedAt === "string" &&
    Array.isArray(value.items) &&
    value.items.every(
      (i) =>
        record(i) &&
        typeof i.id === "string" &&
        typeof i.nftId === "string" &&
        typeof i.editionId === "string" &&
        integer(i.quantity, 1) &&
        typeof i.acknowledgedPriceEth === "string",
    )
  );
}
function valid(value: unknown): value is Snapshot {
  if (
    !record(value) ||
    value.schemaVersion !== 3 ||
    value.seedVersion !== 2 ||
    !integer(value.tick) ||
    value.tick > 1000000 ||
    !record(value.visitors) ||
    !record(value.carts)
  )
    return false;
  const nfts = value.nfts;
  const carts = value.carts;
  return (
    Array.isArray(nfts) &&
    nfts.length === 24 &&
    nfts.every(isNft) &&
    new Set(nfts.map((n) => n.id)).size === 24 &&
    seedNfts().every((seed) => nfts.some((n) => n.id === seed.id)) &&
    Object.values(carts).every(validCart) &&
    Object.values(value.visitors).every(
      (v) => record(v) && typeof v.cartId === "string" && v.cartId in carts,
    )
  );
}
export function createStore(storage: Storage) {
  let state: Snapshot;
  let queue = Promise.resolve();
  function persist(next: Snapshot) {
    storage.setItem(storageKey, JSON.stringify(next));
    state = next;
  }
  function read(): unknown {
    try {
      const raw = storage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  const candidate = read();
  if (valid(candidate)) state = candidate;
  else persist(fresh());
  // Another tab may have persisted a newer snapshot; adopt it before reading
  // or writing so one tab does not overwrite the other's carts with stale data.
  function refresh() {
    const persisted = read();
    if (valid(persisted) && persisted.tick > state.tick) state = persisted;
  }
  function transaction<T>(work: () => T): Promise<T> {
    const result = queue.then(() => {
      refresh();
      return work();
    });
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
  function cartWrite(
    token: string | null,
    change: (draft: Snapshot, cart: StoredCart) => void,
  ) {
    return transaction(() => {
      const next = structuredClone(state);
      const cart = cartFor(next, token);
      change(next, cart);
      persist(next);
      return viewCart(next, cart);
    });
  }
  return {
    snapshot: () => {
      refresh();
      return structuredClone(state);
    },
    reset: () =>
      transaction(() => {
        persist(fresh());
      }),
    createVisitor: () =>
      transaction(() => {
        const next = structuredClone(state);
        const token = `visitor-${crypto.randomUUID()}`;
        createVisitor(next, token);
        persist(next);
        return token;
      }),
    // Reads share the write queue: a read never observes a state older than a
    // write already enqueued before it.
    cart: (token: string | null) =>
      transaction(() => viewCart(state, cartFor(state, token))),
    addItem: (token: string | null, body: unknown) =>
      cartWrite(token, (draft, cart) => addItem(draft, cart, body)),
    changeItem: (token: string | null, itemId: string, body: unknown) =>
      cartWrite(token, (draft, cart) => changeItem(draft, cart, itemId, body)),
    removeItem: (token: string | null, itemId: string) =>
      cartWrite(token, (draft, cart) => removeItem(draft, cart, itemId)),
    applyCoupon: (token: string | null, body: unknown) =>
      cartWrite(token, (draft, cart) => applyCoupon(draft, cart, body)),
    removeCoupon: (token: string | null) =>
      cartWrite(token, (draft, cart) => removeCoupon(draft, cart)),
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
        nft.updatedAt = logicalTime(next.tick);
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
