import {
  integer,
  record,
  timestamp,
  type Category,
  type Network,
  type Eth,
} from "./common";
import { compareEth, isEth, normalizeEth } from "./eth";
export const categories: Category[] = [
  "art",
  "music",
  "photography",
  "3d",
  "collectibles",
  "generative",
  "gaming",
  "memberships",
  "utility",
];
export const networks: Network[] = ["ethereum", "polygon", "solana"];
export const sorts = ["newest", "price-asc", "price-desc", "name-asc"] as const;
export type NftSort = (typeof sorts)[number];
export interface Edition {
  id: string;
  type: "unique" | "limited" | "open";
  label: string;
  purchaseLimit: number;
  priceEth: Eth;
  supply: number;
  available: number;
}
export interface Nft {
  id: string;
  name: string;
  category: Category;
  network: Network;
  artwork: string;
  tokenId: string;
  collection: { id: string; name: string };
  description: string;
  fullDescription: string;
  gallery: string[];
  attributes: Array<{ name: string; value: string }>;
  metadata: {
    contract: string;
    standard: string;
    royalty: string;
    provenance: string;
  };
  discovery: { isNew: boolean; trendingScore: number; rarity: string | null };
  reviews: Array<{
    id: string;
    author: string;
    rating: number;
    content: string;
  }>;

  createdAt: string;
  updatedAt: string;
  version: number;
  editions: Edition[];
}
export interface NftListQuery {
  mode: "all" | "new" | "trending";
  search: string;
  category: Category | "";
  network: Network | "";
  minPrice: Eth | "";
  maxPrice: Eth | "";
  sort: NftSort;
  page: number;
  pageSize: number;
}
export class QueryValidationError extends Error {
  constructor(public fields: Record<string, string>) {
    super("Invalid NFT query");
  }
}
const allowed = [
  "mode",
  "search",
  "category",
  "network",
  "minPrice",
  "maxPrice",
  "sort",
  "page",
  "pageSize",
];
export function parseNftQuery(params: URLSearchParams): NftListQuery {
  const fields: Record<string, string> = {};
  for (const key of params.keys()) {
    if (!allowed.includes(key)) fields[key] = "Unknown parameter";
    else if (params.getAll(key).length > 1) fields[key] = "Repeated parameter";
  }
  const mode = params.get("mode") ?? "all";
  if (!["all", "new", "trending"].includes(mode)) fields.mode = "Invalid mode";
  const search = (params.get("search") ?? "").trim().toLowerCase();
  if (search.length > 100) fields.search = "Maximum 100 characters";
  const category = params.get("category") ?? "",
    network = params.get("network") ?? "",
    sort = params.get("sort") ?? "newest";
  if (category && !categories.includes(category as Category))
    fields.category = "Invalid category";
  if (network && !networks.includes(network as Network))
    fields.network = "Invalid network";
  if (!sorts.includes(sort as NftSort)) fields.sort = "Invalid sort";
  const minPrice = params.get("minPrice") ?? "",
    maxPrice = params.get("maxPrice") ?? "";
  for (const [key, value] of [
    ["minPrice", minPrice],
    ["maxPrice", maxPrice],
  ])
    if (value && !isEth(value))
      fields[key] =
        "Expected non-negative decimal ETH (up to 18 fractional digits)";
  if (
    minPrice &&
    maxPrice &&
    isEth(minPrice) &&
    isEth(maxPrice) &&
    compareEth(minPrice, maxPrice) > 0
  )
    fields.maxPrice = "Must be at least minPrice";
  function pageNumber(key: string, fallback: number, max: number) {
    const raw = params.get(key);
    if (raw === null) return fallback;
    const value = Number(raw);
    if (!/^[1-9]\d*$/.test(raw) || !integer(value, 1) || value > max)
      fields[key] = `Expected integer 1..${max}`;
    return value;
  }
  const page = pageNumber("page", 1, 1000000),
    pageSize = pageNumber("pageSize", 8, 50);
  if (Object.keys(fields).length) throw new QueryValidationError(fields);
  return {
    mode: mode as NftListQuery["mode"],
    search,
    category: category as NftListQuery["category"],
    network: network as NftListQuery["network"],
    minPrice: minPrice ? normalizeEth(minPrice) : "",
    maxPrice: maxPrice ? normalizeEth(maxPrice) : "",
    sort: sort as NftSort,
    page,
    pageSize,
  };
}
export function normalizeNftQuery(
  query: Partial<NftListQuery> = {},
): NftListQuery {
  return parseNftQuery(
    new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])),
  );
}
export function isNft(value: unknown): value is Nft {
  if (
    !record(value) ||
    typeof value.id !== "string" ||
    !value.id ||
    typeof value.name !== "string" ||
    !categories.includes(value.category as Category) ||
    !networks.includes(value.network as Network) ||
    typeof value.artwork !== "string" ||
    typeof value.tokenId !== "string" ||
    !record(value.collection) ||
    typeof value.collection.id !== "string" ||
    typeof value.collection.name !== "string" ||
    typeof value.description !== "string" ||
    typeof value.fullDescription !== "string" ||
    !Array.isArray(value.gallery) ||
    value.gallery.length === 0 ||
    !value.gallery.every((a) => typeof a === "string") ||
    !Array.isArray(value.attributes) ||
    !value.attributes.every(
      (a) =>
        record(a) && typeof a.name === "string" && typeof a.value === "string",
    ) ||
    !record(value.metadata) ||
    !["contract", "standard", "royalty", "provenance"].every(
      (k) =>
        typeof value.metadata === "object" &&
        value.metadata !== null &&
        typeof Reflect.get(value.metadata, k) === "string",
    ) ||
    !record(value.discovery) ||
    typeof value.discovery.isNew !== "boolean" ||
    !integer(value.discovery.trendingScore) ||
    !(
      value.discovery.rarity === null ||
      typeof value.discovery.rarity === "string"
    ) ||
    !Array.isArray(value.reviews) ||
    !value.reviews.every(
      (r) =>
        record(r) &&
        typeof r.id === "string" &&
        typeof r.author === "string" &&
        integer(r.rating, 1) &&
        r.rating <= 5 &&
        typeof r.content === "string",
    ) ||
    !timestamp(value.createdAt) ||
    !timestamp(value.updatedAt) ||
    !integer(value.version, 1) ||
    !Array.isArray(value.editions) ||
    value.editions.length === 0
  )
    return false;
  const ids = new Set<string>();
  return value.editions.every((e) => {
    if (
      !record(e) ||
      typeof e.id !== "string" ||
      !e.id ||
      ids.has(e.id) ||
      !["unique", "limited", "open"].includes(String(e.type)) ||
      typeof e.label !== "string" ||
      !integer(e.purchaseLimit, 1) ||
      !isEth(e.priceEth) ||
      !integer(e.supply, 1) ||
      !integer(e.available) ||
      e.available > e.supply
    )
      return false;
    ids.add(e.id);
    return true;
  });
}
export function lowestPrice(nft: Nft): Eth {
  return nft.editions.reduce(
    (best, e) => (compareEth(e.priceEth, best) < 0 ? e.priceEth : best),
    nft.editions[0].priceEth,
  );
}

export interface NftListResponse {
  data: Nft[];
  pagination: { page: number; pageSize: number; total: number; pages: number };
  facets: {
    categories: Record<Category, number>;
    networks: Record<Network, number>;
    // Lowest and highest edition price among the matches, ignoring the
    // price filter; null when nothing matches.
    price: { min: Eth; max: Eth } | null;
  };
}
