import { http, HttpResponse } from "msw";
import { compareEth } from "@/contracts/eth";
import {
  lowestPrice,
  parseNftQuery,
  QueryValidationError,
  categories,
  networks,
  type Nft,
} from "@/contracts/nfts";
import type { ErrorResponse } from "@/contracts/common";
import { visitorHeader } from "@/contracts/cart";
import { sessionHeader } from "@/contracts/session";
import { ApiError } from "./store/cart";
import type { CartIdentity, MockStore } from "./store";
import type { ScenarioControls } from "./scenarios";
function error(
  status: number,
  code: ErrorResponse["error"]["code"],
  message: string,
  fields?: Record<string, string>,
) {
  return HttpResponse.json<ErrorResponse>(
    { error: { code, message, fields, retryable: code === "TRANSIENT" } },
    { status },
  );
}
export function createHandlers(
  base: string,
  store: MockStore,
  scenarios: ScenarioControls,
) {
  async function condition(request: Request) {
    try {
      const result = await scenarios.before(request);
      const responseDelay = result.responseDelay;
      if (result.failure === "network")
        return { response: HttpResponse.error(), empty: false, responseDelay };
      if (result.failure === "http")
        return {
          response: error(
            503,
            "TRANSIENT",
            "Serviço temporariamente indisponível. Tente novamente.",
          ),
          empty: false,
          responseDelay,
        };
      return { response: null, empty: result.empty, responseDelay };
    } catch {
      return { response: HttpResponse.error(), empty: false, responseDelay: 0 };
    }
  }
  // Session and cart routes: an `Authorization: Bearer` session token wins
  // over the visitor token header when identifying the server-side cart.
  function identityOf(request: Request): CartIdentity {
    const auth = request.headers.get(sessionHeader);
    return {
      session: auth?.startsWith("Bearer ") ? auth.slice(7) : null,
      visitor: request.headers.get(visitorHeader),
    };
  }
  function apiRoute(
    run: (identity: CartIdentity, request: Request) => unknown,
    status = 200,
  ) {
    async function respond(request: Request) {
      try {
        const data = await run(identityOf(request), request);
        return data === undefined
          ? new HttpResponse(null, { status: 204 })
          : HttpResponse.json({ data }, { status });
      } catch (e) {
        if (e instanceof ApiError)
          return error(e.status, e.code, e.message, e.fields);
        throw e;
      }
    }
    return async ({ request }: { request: Request }) => {
      const { response, responseDelay } = await condition(request);
      const result = response ?? (await respond(request));
      if (responseDelay) {
        try {
          await scenarios.pause(responseDelay, request);
        } catch {
          return HttpResponse.error();
        }
      }
      return result;
    };
  }
  async function body(request: Request): Promise<unknown> {
    try {
      return await request.json();
    } catch {
      throw new ApiError(400, "VALIDATION", "Corpo JSON inválido.");
    }
  }
  return [
    http.post(`${base}/visitor-sessions`, async ({ request }) => {
      const { response } = await condition(request);
      if (response) return response;
      return HttpResponse.json(
        { data: { token: await store.createVisitor() } },
        { status: 201 },
      );
    }),
    // Login/register merge the visitor cart named by X-Visitor-Token.
    http.post(
      `${base}/account/register`,
      apiRoute(
        async (identity, request) =>
          store.register(await body(request), identity.visitor),
        201,
      ),
    ),
    http.post(
      `${base}/session/login`,
      apiRoute(async (identity, request) =>
        store.login(await body(request), identity.visitor),
      ),
    ),
    http.get(
      `${base}/session`,
      apiRoute((identity) => store.session(identity.session)),
    ),
    http.post(
      `${base}/session/logout`,
      apiRoute(async (identity) => {
        await store.logout(identity.session);
      }),
    ),
    http.get(
      `${base}/cart`,
      apiRoute((identity) => store.cart(identity)),
    ),
    http.post(
      `${base}/cart/items`,
      apiRoute(async (identity, request) =>
        store.addItem(identity, await body(request)),
      ),
    ),
    http.patch(`${base}/cart/items/:itemId`, (info) =>
      apiRoute(async (identity, request) =>
        store.changeItem(
          identity,
          String(info.params.itemId),
          await body(request),
        ),
      )(info),
    ),
    http.delete(`${base}/cart/items/:itemId`, (info) =>
      apiRoute((identity) =>
        store.removeItem(identity, String(info.params.itemId)),
      )(info),
    ),
    http.put(
      `${base}/cart/coupon`,
      apiRoute(async (identity, request) =>
        store.applyCoupon(identity, await body(request)),
      ),
    ),
    http.delete(
      `${base}/cart/coupon`,
      apiRoute((identity) => store.removeCoupon(identity)),
    ),
    http.get(`${base}/nfts/:id/related`, async ({ request, params }) => {
      const { response } = await condition(request);
      if (response) return response;
      const all = store.snapshot().nfts;
      const nft = all.find((n) => n.id === params.id);
      return nft
        ? HttpResponse.json({
            data: all
              .filter(
                (n) => n.id !== nft.id && n.collection.id === nft.collection.id,
              )
              .slice(0, 5),
          })
        : error(404, "NOT_FOUND", "NFT não encontrado");
    }),
    http.get(`${base}/nfts`, async ({ request }) => {
      let query;
      try {
        query = parseNftQuery(new URL(request.url).searchParams);
      } catch (e) {
        if (e instanceof QueryValidationError)
          return error(400, "VALIDATION", e.message, e.fields);
        throw e;
      }
      const { response, empty } = await condition(request);
      if (response) return response;
      let items = empty
        ? []
        : store
            .snapshot()
            .nfts.filter(
              (n) =>
                n.name.toLowerCase().includes(query.search) &&
                (query.mode !== "new" || n.discovery.isNew) &&
                (query.mode !== "trending" ||
                  n.discovery.trendingScore >= 100) &&
                (!query.category || n.category === query.category) &&
                (!query.network || n.network === query.network) &&
                (!query.minPrice ||
                  compareEth(lowestPrice(n), query.minPrice) >= 0) &&
                (!query.maxPrice ||
                  compareEth(lowestPrice(n), query.maxPrice) <= 0),
            );
      const facets = {
        categories: Object.fromEntries(
          categories.map((c) => [
            c,
            items.filter((n) => n.category === c).length,
          ]),
        ),
        networks: Object.fromEntries(
          networks.map((c) => [c, items.filter((n) => n.network === c).length]),
        ),
      };
      const compare = (a: Nft, b: Nft) =>
        query.sort === "price-asc"
          ? compareEth(lowestPrice(a), lowestPrice(b))
          : query.sort === "price-desc"
            ? compareEth(lowestPrice(b), lowestPrice(a))
            : query.sort === "name-asc"
              ? a.name < b.name
                ? -1
                : a.name > b.name
                  ? 1
                  : 0
              : Date.parse(b.createdAt) - Date.parse(a.createdAt);
      items = items.sort(
        (a, b) =>
          (query.mode === "trending" && query.sort === "newest"
            ? b.discovery.trendingScore - a.discovery.trendingScore
            : 0) ||
          compare(a, b) ||
          (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
      );
      return HttpResponse.json({
        facets,
        data: items.slice(
          (query.page - 1) * query.pageSize,
          query.page * query.pageSize,
        ),
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total: items.length,
          pages: Math.ceil(items.length / query.pageSize),
        },
      });
    }),
    http.get(`${base}/nfts/:id`, async ({ request, params }) => {
      const { response } = await condition(request);
      if (response) return response;
      const nft = store.snapshot().nfts.find((n) => n.id === params.id);
      return nft
        ? HttpResponse.json({ data: nft })
        : error(404, "NOT_FOUND", "NFT not found");
    }),
    // Unsupported API routes fail explicitly instead of falling through to SPA HTML.
    http.all(`${base}/*`, () =>
      error(
        501,
        "NOT_IMPLEMENTED",
        "Endpoint not implemented in this milestone",
      ),
    ),
  ];
}
