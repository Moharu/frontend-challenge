import { normalizeNftQuery, type NftListQuery } from "@/contracts/nfts";
export function discoverySearch(input: unknown): NftListQuery {
  const source = (
    typeof input === "object" && input !== null ? input : {}
  ) as Record<string, unknown>;
  const result = normalizeNftQuery({ pageSize: 9 });
  for (const key of Object.keys(result) as Array<keyof NftListQuery>) {
    if (source[key] === undefined) continue;
    try {
      Object.assign(
        result,
        normalizeNftQuery({ ...result, [key]: source[key] }),
      );
    } catch {
      /* URLs inválidas usam o padrão do campo. */
    }
  }
  return result;
}
