import { isNft, type Nft } from "@/contracts/nfts";
import { record, integer } from "@/contracts/common";
import {
  fixturePasswords,
  fixtureUsers,
  fixtureWallets,
  seedNfts,
} from "./seed";
import { isWallet } from "@/contracts/wallets";
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
} from "./accounts";
import {
  connectWallet,
  issueQuote,
  createWallet,
  defaultQuoteTtlMs,
  disconnectAll,
  getConnection,
  listWallets,
  updateWallet,
} from "./wallets";
import {
  addFavorite,
  changePassword,
  getProfile,
  listFavorites,
  removeFavorite,
  updateAvatar,
  updateProfile,
  type ProfileState,
} from "./profile";
import {
  createOrder,
  getOrder,
  getReceipt,
  resolveDue,
  QuoteChangedError,
  type PaymentOutcome,
} from "./orders";
// Who a cart request belongs to: an authenticated session wins over a visitor.
export interface CartIdentity {
  session: string | null;
  visitor: string | null;
}
export const storageKey = "kurio.mock.catalog.v1";
export interface Snapshot extends ProfileState {
  schemaVersion: 7;
  seedVersion: 2;
  tick: number;
  nfts: Nft[];
}
function fresh(): Snapshot {
  const state: Snapshot = {
    schemaVersion: 7,
    seedVersion: 2,
    tick: 0,
    nfts: seedNfts(),
    visitors: {},
    carts: {},
    accounts: {},
    sessions: {},
    generation: 0,
    wallets: Object.fromEntries(
      fixtureWallets.map((w) => [w.id, structuredClone(w)]),
    ),
    connections: {},
    expiredCoupons: [],
    quotes: {},
    quoteSequence: 0,
    orders: {},
    idempotency: {},
    orderSequence: 0,
    favorites: {},
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
    value.schemaVersion !== 7 ||
    value.seedVersion !== 2 ||
    !integer(value.tick) ||
    value.tick > 1000000 ||
    !record(value.visitors) ||
    !record(value.carts) ||
    !record(value.accounts) ||
    !record(value.sessions) ||
    !integer(value.generation) ||
    !record(value.wallets) ||
    !Object.values(value.wallets).every(isWallet) ||
    !record(value.connections) ||
    !Array.isArray(value.expiredCoupons) ||
    !record(value.quotes) ||
    !integer(value.quoteSequence) ||
    !record(value.orders) ||
    !record(value.idempotency) ||
    !integer(value.orderSequence) ||
    !record(value.favorites)
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
        typeof a.password.hash === "string" &&
        integer(a.profileVersion, 1),
    )
  );
}
// The simulated payment resolves after a short delay (real clock).
export const defaultPaymentDelayMs = 1500;
function nftEvent(state: Snapshot, id: string): NftUpdated {
  const nft = state.nfts.find((n) => n.id === id)!;
  return {
    type: "nft.updated",
    eventId: `catalog-${id}-${nft.version}`,
    resourceId: id,
    version: nft.version,
    timestamp: nft.updatedAt,
    payload: structuredClone(nft),
  };
}
export function createStore(storage: Storage) {
  let state: Snapshot;
  let queue = Promise.resolve();
  // Test-only overrides (quote TTL and the simulated payment) live in
  // sessionStorage so they survive the page loads of a test, like the
  // session-check failures.
  const ttlKey = "kurio.mock.quote-ttl";
  const paymentKey = "kurio.mock.payment";
  const payment = (): { outcome: PaymentOutcome; delayMs: number } => {
    try {
      const value = JSON.parse(sessionStorage.getItem(paymentKey) ?? "null");
      if (record(value) && record(value.outcome) && integer(value.delayMs))
        return value as { outcome: PaymentOutcome; delayMs: number };
    } catch {
      // Default below.
    }
    return { outcome: { status: "confirmed" }, delayMs: defaultPaymentDelayMs };
  };
  const quoteTtl = () => {
    try {
      const value = Number(sessionStorage.getItem(ttlKey));
      return value > 0 ? value : defaultQuoteTtlMs;
    } catch {
      return defaultQuoteTtlMs;
    }
  };
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
        try {
          sessionStorage.removeItem(ttlKey);
          sessionStorage.removeItem(paymentKey);
        } catch {
          // Nothing stored.
        }
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
    wallets: (token: string | null) =>
      transaction(() => listWallets(state, token)),
    createWallet: (token: string | null, body: unknown) =>
      write((draft) => createWallet(draft, token, body)),
    updateWallet: (token: string | null, id: string, body: unknown) =>
      write((draft) => updateWallet(draft, token, id, body)),
    profile: (token: string | null) =>
      transaction(() => getProfile(state, token)),
    updateProfile: (token: string | null, body: unknown) =>
      write((draft) => updateProfile(draft, token, body)),
    updateAvatar: (token: string | null, body: unknown) =>
      write((draft) => updateAvatar(draft, token, body)),
    changePassword: (token: string | null, body: unknown) =>
      write((draft) => changePassword(draft, token, body)),
    favorites: (token: string | null) =>
      transaction(() => listFavorites(state, token)),
    addFavorite: (token: string | null, body: unknown) =>
      write((draft) =>
        addFavorite(draft, token, body, new Date().toISOString()),
      ),
    removeFavorite: (token: string | null, nftId: string) =>
      write((draft) => removeFavorite(draft, token, nftId)),
    connectWallet: (token: string | null, body: unknown) =>
      write((draft) => connectWallet(draft, token, body)),
    connection: (token: string | null, id: string) =>
      transaction(() => getConnection(state, token, id)),
    // Quotes are persisted (version rule and order comparison).
    quote: (identity: CartIdentity, body: unknown) =>
      write((draft) =>
        issueQuote(
          draft,
          identity.session,
          cartFor(draft, { session: identity.session, visitor: null }),
          body,
          quoteTtl(),
        ),
      ),
    // Idempotent order creation. A changed quote is saved before the 409 is
    // returned, so the client can confirm the fresh one.
    createOrder: (token: string | null, key: string | null, body: unknown) =>
      transaction(() => {
        const next = structuredClone(state);
        const { outcome, delayMs } = payment();
        try {
          const result = createOrder(next, token, key, body, {
            now: Date.now(),
            delayMs,
            outcome,
            quoteTtlMs: quoteTtl(),
          });
          if (result.created) {
            next.tick++;
            persist(next);
          }
          return {
            ...result,
            events: result.nftIds.map((id) => nftEvent(next, id)),
          };
        } catch (error) {
          if (error instanceof QuoteChangedError) {
            next.tick++;
            persist(next);
          }
          throw error;
        }
      }),
    order: (token: string | null, id: string) =>
      transaction(() => getOrder(state, token, id)),
    receipt: (token: string | null, id: string) =>
      transaction(() => getReceipt(state, token, id)),
    // Resolves overdue payments (on start, on every order access and on the
    // page timer). Returns what changed, for the socket events.
    resolveDue: (force = false) =>
      transaction(() => {
        const now = Date.now();
        const pending = Object.values(state.orders).some(
          (o) => o.status === "pending" && (force || o.resolveAt <= now),
        );
        if (!pending) return { orders: [], events: [] as NftUpdated[] };
        const next = structuredClone(state);
        if (force)
          for (const o of Object.values(next.orders))
            if (o.status === "pending") o.resolveAt = now;
        const result = resolveDue(next, now);
        next.tick++;
        persist(next);
        return {
          orders: result.orders,
          events: result.nftIds.map((id) => nftEvent(next, id)),
        };
      }),
    // Simulated payment of the next orders: outcome and resolution delay.
    setPayment: (
      outcome: PaymentOutcome,
      delayMs: number = defaultPaymentDelayMs,
    ) => {
      if (!Number.isSafeInteger(delayMs) || delayMs < 0 || delayMs > 3600000)
        throw new Error("Payment delay must be 0..3600000 ms");
      try {
        sessionStorage.setItem(
          paymentKey,
          JSON.stringify({ outcome, delayMs }),
        );
      } catch {
        // Storage unavailable: the default payment applies.
      }
    },
    // Test-only scenario controls (no public endpoint).
    disconnectWallets: () => write((draft) => disconnectAll(draft)),
    expireCoupon: (code: string) =>
      write((draft) => {
        if (!draft.expiredCoupons.includes(code))
          draft.expiredCoupons.push(code);
      }),
    setQuoteTtl: (ms: number) => {
      if (!Number.isSafeInteger(ms) || ms < 0 || ms > defaultQuoteTtlMs)
        throw new Error("Quote TTL must be 0..120000 ms");
      try {
        sessionStorage.setItem(ttlKey, String(ms));
      } catch {
        // Storage unavailable: the default TTL applies.
      }
    },
    expireSession: (token: string) =>
      write((draft) => expireSession(draft, token)),
    revokeSession: (token: string) =>
      write((draft) => revokeSession(draft, token)),
    update: (
      id: string,
      editionId: string,
      patch: { priceEth?: string; available?: number; name?: string },
    ) =>
      transaction((): NftUpdated => {
        const next = structuredClone(state);
        const nft = next.nfts.find((n) => n.id === id);
        const edition = nft?.editions.find((e) => e.id === editionId);
        if (!nft || !edition) throw new Error("Unknown NFT or edition");
        if (
          Object.keys(patch).some(
            (key) =>
              key !== "priceEth" && key !== "available" && key !== "name",
          )
        )
          throw new Error("Unknown update field");
        if ("priceEth" in patch) edition.priceEth = patch.priceEth!;
        if ("available" in patch) edition.available = patch.available!;
        if ("name" in patch) nft.name = patch.name!;
        next.tick++;
        nft.version++;
        nft.updatedAt = logicalTime(next.tick);
        if (!isNft(nft)) throw new Error("Invalid NFT update");
        persist(next);
        return nftEvent(next, id);
      }),
  };
}
export type MockStore = ReturnType<typeof createStore>;
