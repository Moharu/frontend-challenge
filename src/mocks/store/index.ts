import { isNft, type Nft } from "@/contracts/nfts";
import { record, integer } from "@/contracts/common";
import { fixturePasswords, fixtureUsers, seedNfts } from "./seed";
import type { NftUpdated } from "@/contracts/events";
import {
  addItem,
  applyCoupon,
  changeItem,
  createVisitor,
  logicalTime,
  removeCoupon,
  removeItem,
  viewCart,
  visitorCart,
  type StoredCart,
} from "./cart";
import {
  accountCart,
  expireSession,
  login,
  logout,
  register,
  revokeSession,
  seedAccount,
  viewSession,
  type AccountsState,
} from "./accounts";
// Who a cart request belongs to: an authenticated session wins over a visitor.
export interface CartIdentity {
  session: string | null;
  visitor: string | null;
}
export const storageKey = "kurio.mock.catalog.v1";
export interface Snapshot extends AccountsState {
  schemaVersion: 4;
  seedVersion: 2;
  tick: number;
  nfts: Nft[];
}
function fresh(): Snapshot {
  const state: Snapshot = {
    schemaVersion: 4,
    seedVersion: 2,
    tick: 0,
    nfts: seedNfts(),
    visitors: {},
    carts: {},
    accounts: {},
    sessions: {},
    generation: 0,
  };
  for (const user of fixtureUsers)
    seedAccount(state, {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      password: fixturePasswords[user.id],
    });
  return state;
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
    value.schemaVersion !== 4 ||
    value.seedVersion !== 2 ||
    !integer(value.tick) ||
    value.tick > 1000000 ||
    !record(value.visitors) ||
    !record(value.carts) ||
    !record(value.accounts) ||
    !record(value.sessions) ||
    !integer(value.generation)
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
    ) &&
    Object.values(value.accounts).every(
      (a) =>
        record(a) &&
        typeof a.id === "string" &&
        typeof a.email === "string" &&
        typeof a.cartId === "string" &&
        a.cartId in carts &&
        record(a.password) &&
        typeof a.password.hash === "string",
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
  function transaction<T>(work: () => T | Promise<T>): Promise<T> {
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
  function cartFor(draft: Snapshot, identity: CartIdentity) {
    return identity.session
      ? accountCart(draft, identity.session)
      : visitorCart(draft, identity.visitor);
  }
  function cartWrite(
    identity: CartIdentity,
    change: (draft: Snapshot, cart: StoredCart) => void,
  ) {
    return transaction(() => {
      const next = structuredClone(state);
      const cart = cartFor(next, identity);
      change(next, cart);
      persist(next);
      return viewCart(next, cart);
    });
  }
  // Writes that touch sessions/accounts; the async password work runs inside
  // the serialized queue, and nothing is persisted when it throws.
  function write<T>(work: (draft: Snapshot) => T | Promise<T>) {
    return transaction(async () => {
      const next = structuredClone(state);
      const result = await work(next);
      next.tick++;
      persist(next);
      return result;
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
    cart: (identity: CartIdentity) =>
      transaction(() => viewCart(state, cartFor(state, identity))),
    addItem: (identity: CartIdentity, body: unknown) =>
      cartWrite(identity, (draft, cart) => addItem(draft, cart, body)),
    changeItem: (identity: CartIdentity, itemId: string, body: unknown) =>
      cartWrite(identity, (draft, cart) =>
        changeItem(draft, cart, itemId, body),
      ),
    removeItem: (identity: CartIdentity, itemId: string) =>
      cartWrite(identity, (draft, cart) => removeItem(draft, cart, itemId)),
    applyCoupon: (identity: CartIdentity, body: unknown) =>
      cartWrite(identity, (draft, cart) => applyCoupon(draft, cart, body)),
    removeCoupon: (identity: CartIdentity) =>
      cartWrite(identity, (draft, cart) => removeCoupon(draft, cart)),
    register: (body: unknown, visitor: string | null) =>
      write((draft) => register(draft, body, visitor)),
    login: (body: unknown, visitor: string | null) =>
      write((draft) => login(draft, body, visitor)),
    logout: (token: string | null) => write((draft) => logout(draft, token)),
    session: (token: string | null) =>
      transaction(() => viewSession(state, token ?? "")),
    // Test-only scenario controls (no public endpoint).
    expireSession: (token: string) =>
      write((draft) => expireSession(draft, token)),
    revokeSession: (token: string) =>
      write((draft) => revokeSession(draft, token)),
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
