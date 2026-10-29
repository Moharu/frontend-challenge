import { integer, record, timestamp } from "./common";
import { isNft, type Nft } from "./nfts";
import type { Order } from "./orders";
export interface EventEnvelope<Name extends string, Payload> {
  type: Name;
  eventId: string;
  resourceId: string;
  version: number;
  timestamp: string;
  payload: Payload;
}
export type NftUpdated = EventEnvelope<"nft.updated", Nft>;
// Inclui os snapshots imutáveis do colecionador e da carteira de Order.
export type OrderUpdated = EventEnvelope<"order.updated", Order> & {
  audience: { userId: string; sessionId: string; sessionGeneration: number };
};
export function isNftUpdated(value: unknown): value is NftUpdated {
  return (
    record(value) &&
    value.type === "nft.updated" &&
    typeof value.eventId === "string" &&
    value.eventId.length > 0 &&
    typeof value.resourceId === "string" &&
    integer(value.version, 1) &&
    timestamp(value.timestamp) &&
    isNft(value.payload) &&
    value.payload.id === value.resourceId &&
    value.payload.version === value.version &&
    value.payload.updatedAt === value.timestamp
  );
}
