import { http, HttpResponse } from "msw";
import { compareEth } from "@/contracts/eth";
import {
  lowestPrice,
  parseNftQuery,
  QueryValidationError,
  type Nft,
} from "@/contracts/nfts";
import type { ErrorResponse } from "@/contracts/common";
import type { MockStore } from "./store";
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
      if (result.failure === "network")
        return { response: HttpResponse.error(), empty: false };
      if (result.failure === "http")
        return {
          response: error(503, "TRANSIENT", "Catalog temporarily unavailable"),
          empty: false,
        };
      return { response: null, empty: result.empty };
    } catch {
      return { response: HttpResponse.error(), empty: false };
    }
  }
  return [
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
                (!query.category || n.category === query.category) &&
                (!query.network || n.network === query.network) &&
                (!query.minPrice ||
                  compareEth(lowestPrice(n), query.minPrice) >= 0) &&
                (!query.maxPrice ||
                  compareEth(lowestPrice(n), query.maxPrice) <= 0),
            );
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
        (a, b) => compare(a, b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
      );
      return HttpResponse.json({
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
