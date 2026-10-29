import { http } from "@/lib/http";
import { isNft, type Nft, type NftListQuery } from "@/contracts/nfts";
import {
  record,
  integer,
  type DataResponse,
  type PageResponse,
} from "@/contracts/common";
export async function listNfts(
  query: NftListQuery,
  signal?: AbortSignal,
): Promise<PageResponse<Nft>> {
  const { data: value } = await http.get<unknown>("/nfts", {
    params: query,
    signal,
  });
  if (
    !record(value) ||
    !Array.isArray(value.data) ||
    !value.data.every(isNft) ||
    !record(value.pagination) ||
    !integer(value.pagination.page, 1) ||
    !integer(value.pagination.pageSize, 1) ||
    !integer(value.pagination.total) ||
    !integer(value.pagination.pages)
  )
    throw new Error("Invalid NFT list response");
  return value as unknown as PageResponse<Nft>;
}
export async function getNft(
  id: string,
  signal?: AbortSignal,
): Promise<DataResponse<Nft>> {
  const { data: value } = await http.get<unknown>(
    `/nfts/${encodeURIComponent(id)}`,
    { signal },
  );
  if (!record(value) || !isNft(value.data) || value.data.id !== id)
    throw new Error("Invalid NFT detail response");
  return { data: value.data };
}
