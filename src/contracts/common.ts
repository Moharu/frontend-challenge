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
  | "TRANSIENT"
  | "NOT_IMPLEMENTED";
export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    fields?: Record<string, string>;
    retryable: boolean;
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
