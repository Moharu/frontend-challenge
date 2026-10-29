import {
  integer,
  record,
  timestamp,
  type Category,
  type Network,
  type Eth,
} from "./common";
import { compareEth, isEth, normalizeEth } from "./eth";
export const categories: Category[] = ["art", "music", "photography"];
export const networks: Network[] = ["ethereum", "polygon"];
export const sorts = ["newest", "price-asc", "price-desc", "name-asc"] as const;
export type NftSort = (typeof sorts)[number];
export interface Edition {
  id: string;
  type: "unique" | "limited" | "open";
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
  createdAt: string;
  updatedAt: string;
  version: number;
  editions: Edition[];
}
export interface NftListQuery {
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
