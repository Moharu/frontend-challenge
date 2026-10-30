import { record, timestamp } from "./common";
export interface Favorite {
  nftId: string;
  createdAt: string;
}
export interface AddFavoriteRequest {
  nftId: string;
}
export function isFavorite(value: unknown): value is Favorite {
  return (
    record(value) &&
    typeof value.nftId === "string" &&
    timestamp(value.createdAt)
  );
}
