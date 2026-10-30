import { http } from "@/lib/http";
import {
  isNft,
  categories,
  networks,
  type Nft,
  type NftListQuery,
  type NftListResponse,
} from "@/contracts/nfts";
import { record, integer, type DataResponse } from "@/contracts/common";
import { isEth } from "@/contracts/eth";
export async function listNfts(
  query: NftListQuery,
  signal?: AbortSignal,
): Promise<NftListResponse> {
  const { data: value } = await http.get<unknown>("/nfts", {
    params: query,
    signal,
  });
  if (
    !record(value) ||
    !Array.isArray(value.data) ||
    !value.data.every(isNft) ||
    !record(value.facets) ||
    !record(value.facets.categories) ||
    !record(value.facets.networks) ||
    !categories.every(
      (k) =>
        record(value.facets) &&
        record(value.facets.categories) &&
        integer(value.facets.categories[k]),
    ) ||
    !networks.every(
      (k) =>
        record(value.facets) &&
        record(value.facets.networks) &&
        integer(value.facets.networks[k]),
    ) ||
    !(
      value.facets.price === null ||
      (record(value.facets.price) &&
        isEth(value.facets.price.min) &&
        isEth(value.facets.price.max))
    ) ||
    !record(value.pagination) ||
    !integer(value.pagination.page, 1) ||
    !integer(value.pagination.pageSize, 1) ||
    !integer(value.pagination.total) ||
    !integer(value.pagination.pages)
  )
    throw new Error("Invalid NFT list response");
  return value as unknown as NftListResponse;
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

export async function relatedNfts(
  id: string,
  signal?: AbortSignal,
): Promise<Nft[]> {
  const { data } = await http.get<{ data: unknown }>(
    `/nfts/${encodeURIComponent(id)}/related`,
    { signal },
  );
  if (!Array.isArray(data.data) || !data.data.every(isNft))
    throw new Error("Resposta de relacionados inválida");
  return data.data;
}
