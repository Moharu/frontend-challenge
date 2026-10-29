import { queryOptions } from "@tanstack/react-query";
import { normalizeNftQuery, type NftListQuery } from "@/contracts/nfts";
import { getNft, listNfts } from "./api";
export const nftKeys = {
  all: ["nfts"] as const,
  lists: () => ["nfts", "list"] as const,
  list: (query: NftListQuery) => ["nfts", "list", query] as const,
  details: () => ["nfts", "detail"] as const,
  detail: (id: string) => ["nfts", "detail", id] as const,
};
export function nftListOptions(input: Partial<NftListQuery> = {}) {
  const query = normalizeNftQuery(input);
  return queryOptions({
    queryKey: nftKeys.list(query),
    queryFn: ({ signal }) => listNfts(query, signal),
    retry: false,
    staleTime: 0,
  });
}
export function nftDetailOptions(id: string) {
  return queryOptions({
    queryKey: nftKeys.detail(id),
    queryFn: ({ signal }) => getNft(id, signal),
    retry: false,
    staleTime: 0,
  });
}
