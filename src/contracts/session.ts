import { integer, record, timestamp, type UserIdentity } from "./common";
// The API issues an opaque session token, sent as `Authorization: Bearer`.
// Simulation only: a token readable by JavaScript would be an HttpOnly,
// Secure, SameSite cookie in production.
export const sessionHeader = "Authorization";
export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}
export interface LoginRequest {
  email: string;
  password: string;
}
export interface Session {
  id: string;
  user: UserIdentity;
  expiresAt: string;
  // Changes on every login, logout and user switch; responses and events from
  // another generation are discarded.
  generation: number;
}
// Outcome of merging the visitor cart (sent as X-Visitor-Token) into the
// user's cart on login/register. null when there was no visitor cart.
export interface CartMergeResult {
  addedLines: number;
  mergedLines: number;
  conflictLines: number;
  coupon: string | null;
}
export interface AuthResponse {
  token: string;
  session: Session;
  merge: CartMergeResult | null;
}
// Username: 3-20 of [a-z0-9_], compared case-insensitively (stored lowercase).
export const usernamePattern = /^[a-z0-9_]{3,20}$/;
export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const passwordMinLength = 8;
export const passwordMaxLength = 128;
// Shared by the simulated server and the forms, so both apply the same rules.
export function registrationErrors(input: {
  username: string;
  email: string;
  password: string;
}): Record<string, string> {
  const fields: Record<string, string> = {};
  if (!usernamePattern.test(input.username.trim().toLowerCase()))
    fields.username =
      "Use de 3 a 20 caracteres: letras sem acento, números ou _.";
  if (!emailPattern.test(input.email.trim()))
    fields.email = "Informe um e-mail válido.";
  const password = passwordErrors(input.password);
  if (password) fields.password = password;
  return fields;
}
// The password rule (sign-up and password change).
export function passwordErrors(password: string): string | null {
  return password.length < passwordMinLength ||
    password.length > passwordMaxLength ||
    !/[a-zA-Z]/.test(password) ||
    !/\d/.test(password)
    ? `Use pelo menos ${passwordMinLength} caracteres, com uma letra e um número.`
    : null;
}
function isIdentity(value: unknown): value is UserIdentity {
  return (
    record(value) &&
    typeof value.id === "string" &&
    typeof value.username === "string" &&
    (value.displayName === null || typeof value.displayName === "string") &&
    typeof value.email === "string"
  );
}
export function isSession(value: unknown): value is Session {
  return (
    record(value) &&
    typeof value.id === "string" &&
    isIdentity(value.user) &&
    timestamp(value.expiresAt) &&
    integer(value.generation, 1)
  );
}
export function isAuthResponse(value: unknown): value is AuthResponse {
  if (!record(value) || typeof value.token !== "string") return false;
  const merge = value.merge;
  return (
    isSession(value.session) &&
    (merge === null ||
      (record(merge) &&
        integer(merge.addedLines) &&
        integer(merge.mergedLines) &&
        integer(merge.conflictLines) &&
        (merge.coupon === null || typeof merge.coupon === "string")))
  );
}
