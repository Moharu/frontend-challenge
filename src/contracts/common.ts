export type Eth = string;
export type Network = "ethereum" | "polygon" | "solana";
export type Category =
  | "art"
  | "music"
  | "photography"
  | "3d"
  | "collectibles"
  | "generative"
  | "gaming"
  | "memberships"
  | "utility";
export interface DataResponse<T> {
  data: T;
}
export type ErrorCode =
  | "VALIDATION"
  | "SESSION_INVALID"
  | "VISITOR_INVALID"
  | "INVALID_CREDENTIALS"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  // 409 refinements the checkout branches on (quote and wallet connection).
  | "CART_CHANGED"
  | "UNAVAILABLE_ITEMS"
  | "WALLET_DISCONNECTED"
  | "CONNECTION_REJECTED"
  // The quote referenced by an order is no longer valid; the error body
  // carries the fresh quote in `error.quote`.
  | "QUOTE_CHANGED"
  | "TRANSIENT"
  | "NOT_IMPLEMENTED";
export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    fields?: Record<string, string>;
    retryable: boolean;
    // Only with QUOTE_CHANGED: the server's current quote.
    quote?: unknown;
  };
}
export interface PageResponse<T> {
  data: T[];
  pagination: { page: number; pageSize: number; total: number; pages: number };
}
export interface UserIdentity {
  id: string;
  username: string;
  displayName: string | null;
  email: string;
}
export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function integer(value: unknown, min = 0): value is number {
  return (
    typeof value === "number" && Number.isSafeInteger(value) && value >= min
  );
}
export function timestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}
