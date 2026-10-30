// Imported only by explicitly opted-in integration builds, never by product code.
import { QueryObserver } from "@tanstack/react-query";
import axios from "axios";
import { queryClient } from "@/lib/query-client";
import { http } from "@/lib/http";
import { nftDetailOptions, nftListOptions, nftKeys } from "@/data/nfts/queries";
import { getNft } from "@/data/nfts/api";
import type { NftListQuery, Nft } from "@/contracts/nfts";
import type { DataResponse } from "@/contracts/common";
import { compareEth } from "@/contracts/eth";
import { createCatalogRealtime } from "@/realtime/catalog";
import { getRealtime } from "@/realtime/instance";
import type { MockControls } from "@/mocks/browser";
import { cartKey } from "@/data/cart/queries";
import { cartScope, getIdentity, signOut } from "@/data/session/identity";
import { io } from "socket.io-client";
import { apiURL } from "@/lib/urls";
import { authenticateEvent } from "@/contracts/events";

export function installHarness(controls: MockControls, baseURL: string) {
  let realtime = createCatalogRealtime(queryClient, baseURL);
  let stopList = () => {};
  let stopDetail = () => {};
  let selectQuery: ((input: Partial<NftListQuery>) => void) | null = null;
  let selected: {
    ids: string[];
    search: string;
    fetching: boolean;
    error: string | null;
  } | null = null;
  const transport = { requests: 0, aborted: 0 };
  http.interceptors.request.use((config) => {
    transport.requests++;
    config.signal?.addEventListener?.(
      "abort",
      () => {
        transport.aborted++;
      },
      { once: true },
    );
    return config;
  });
  const harness = {
    async reset() {
      realtime.dispose();
      stopList();
      stopDetail();
      selectQuery = null;
      selected = null;
      await queryClient.cancelQueries();
      queryClient.clear();
      await controls.reset();
      realtime = createCatalogRealtime(queryClient, baseURL);
      transport.requests = 0;
      transport.aborted = 0;
    },
    list: (input: Partial<NftListQuery> = {}) =>
      queryClient.fetchQuery(nftListOptions(input)),
    detail: (id: string) => queryClient.fetchQuery(nftDetailOptions(id)),
    async request(path: string) {
      try {
        const result = await http.get<unknown>(path);
        return { status: result.status, body: result.data, network: false };
      } catch (error) {
        if (!axios.isAxiosError(error)) throw error;
        return {
          status: error.response?.status ?? 0,
          body: error.response?.data as unknown,
          network: !error.response,
        };
      }
    },
    async rawDetail(id: string) {
      return getNft(id);
    },
    select(input: Partial<NftListQuery>) {
      if (!selectQuery) {
        const observer = new QueryObserver(queryClient, nftListOptions(input));
        stopList = observer.subscribe((result) => {
          const query = observer.options.queryKey[2];
          selected = {
            ids: result.data?.data.map((n) => n.id) ?? [],
            search: query.search,
            fetching: result.isFetching,
            error: result.error?.message ?? null,
          };
        });
        selectQuery = (next) => observer.setOptions(nftListOptions(next));
      } else selectQuery(input);
    },
    watchDetail(id: string) {
      stopDetail();
      const observer = new QueryObserver(queryClient, nftDetailOptions(id));
      stopDetail = observer.subscribe(() => {});
    },
    state(id = "nft-001") {
      return {
        selected,
        transport: { ...transport },
        detail:
          queryClient.getQueryData<DataResponse<Nft>>(nftKeys.detail(id))
            ?.data ?? null,
        stats: { ...realtime.stats },
        connected: realtime.socket.connected,
        listeners: realtime.socket.listeners("nft.updated").length,
        serverConnections: controls.connections(),
        requests: { ...controls.scenarios.stats },
      };
    },
    // Counters of the app's own realtime client (the one the layout runs).
    liveStats: () => {
      const live = getRealtime();
      return live ? { ...live.stats } : null;
    },
    connect: () => realtime.connect(),
    disconnect: () => realtime.disconnect(),
    dispose: () => realtime.dispose(),
    recreate() {
      realtime.dispose();
      realtime = createCatalogRealtime(queryClient, baseURL);
    },
    update: controls.update,
    persistUpdate: controls.store.update,
    replay: controls.replay,
    duplicate: controls.duplicate,
    older: controls.older,
    interrupt: controls.interrupt,
    restore: controls.restore,
    scenario: controls.scenarios.select,
    delay: controls.scenarios.setDelay,
    failNext: controls.scenarios.failNext,
    failNextCart: controls.scenarios.failNextCart,
    cartDelay: controls.scenarios.setCartDelay,
    failSessionChecks: controls.scenarios.failSessionChecks,
    // Checkout: wallet connection and quote scenarios.
    rejectNextConnection: controls.scenarios.rejectNextConnection,
    failNextCheckout: controls.scenarios.failNextCheckout,
    failNextFavorite: controls.scenarios.failNextFavorite,
    favoriteDelay: controls.scenarios.setFavoriteDelay,
    profileDelay: controls.scenarios.setProfileDelay,
    checkoutDelay: controls.scenarios.setCheckoutDelay,
    disconnectWallets: controls.store.disconnectWallets,
    expireCoupon: controls.store.expireCoupon,
    quoteTtl: controls.store.setQuoteTtl,
    // Orders: simulated payment, lost response, order events.
    setPayment: controls.setPayment,
    resolvePayments: controls.resolvePayments,
    loseNextOrderResponse: controls.loseNextOrderResponse,
    changeBeforeNextOrder: controls.changeBeforeNextOrder,
    duplicateOrder: controls.duplicateOrder,
    staleOrder: controls.staleOrder,
    authenticatedSockets: controls.authenticatedSockets,
    // A separate socket connection authenticated with `token` (or anonymous),
    // recording the name of every event it receives: the socket traffic
    // another user (or a visitor) would see.
    probeSocket(token: string | null) {
      const url = new URL(apiURL(baseURL));
      const probe = io(url.origin, {
        path: `${url.pathname.replace(/\/$/, "")}/socket.io/`,
        transports: ["websocket"],
        forceNew: true,
      });
      const received: string[] = [];
      probe.onAny((name: string) => received.push(name));
      probe.on("connect", () => probe.emit(authenticateEvent, { token }));
      return {
        received: () => [...received],
        connected: () => probe.connected,
        close: () => probe.disconnect(),
      };
    },
    // Drops the cached cart so the next observer starts from a pending query.
    forgetCart: () => queryClient.removeQueries({ queryKey: ["cart"] }),
    // Session controls act on the client's current session token.
    identity: () => {
      const { sessionToken, session, visitorToken, status } = getIdentity();
      return { sessionToken, session, visitorToken, status };
    },
    signOut,
    // The client's session, or the one of `token`.
    expireSession: (token?: string) =>
      controls.store.expireSession(token ?? getIdentity().sessionToken ?? ""),
    revokeSession: (token?: string) =>
      controls.store.revokeSession(token ?? getIdentity().sessionToken ?? ""),
    // Cart query diagnostics: each fetched or written cart increments the count.
    cartQuery: () => {
      const state = queryClient.getQueryState(cartKey(cartScope()));
      return {
        dataUpdateCount: state?.dataUpdateCount ?? 0,
        fetchStatus: state?.fetchStatus ?? "idle",
      };
    },
    snapshot: controls.store.snapshot,
    compareEth,
  };
  Object.assign(window, { __KURIO_TEST__: harness });
  return harness;
}
export type Harness = ReturnType<typeof installHarness>;
