import { integer, record, timestamp } from "./common";
import { isNft, type Nft } from "./nfts";
import { isOrder, type Order } from "./orders";
export interface EventEnvelope<Name extends string, Payload> {
  type: Name;
  eventId: string;
  resourceId: string;
  version: number;
  timestamp: string;
  payload: Payload;
}
export type NftUpdated = EventEnvelope<"nft.updated", Nft>;
// Private: delivered only to socket connections authenticated as the order's
// owner (see the mock socket). Carries the full Order, with its immutable
// snapshots; `version` is the order's version.
export type OrderUpdated = EventEnvelope<"order.updated", Order> & {
  audience: { userId: string; sessionId: string; sessionGeneration: number };
};
// Sent by the client right after connecting and on every identity change
// (the Socket.IO binding in use does not expose the handshake `auth`).
export const authenticateEvent = "session.authenticate";
export interface AuthenticatePayload {
  token: string | null;
}
export function isOrderUpdated(value: unknown): value is OrderUpdated {
  const audience = record(value) ? value.audience : undefined;
  return (
    record(value) &&
    value.type === "order.updated" &&
    typeof value.eventId === "string" &&
    value.eventId.length > 0 &&
    typeof value.resourceId === "string" &&
    integer(value.version, 1) &&
    timestamp(value.timestamp) &&
    isOrder(value.payload) &&
    value.payload.id === value.resourceId &&
    value.payload.version === value.version &&
    record(audience) &&
    typeof audience.userId === "string" &&
    typeof audience.sessionId === "string" &&
    integer(audience.sessionGeneration, 1) &&
    audience.userId === value.payload.userId
  );
}
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
