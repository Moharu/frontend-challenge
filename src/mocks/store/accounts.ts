import type { CartMergeResult, Session } from "@/contracts/session";
import { registrationErrors } from "@/contracts/session";
import {
  ApiError,
  logicalTime,
  viewCart,
  type CommerceState,
  type StoredCart,
} from "./cart";
import { hashPassword, verifyPassword, type PasswordHash } from "./passwords";
import { sessionDurationMs } from "./seed";
export interface StoredAccount {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  password: PasswordHash;
  createdAt: string;
  cartId: string;
}
export interface StoredSession {
  id: string;
  userId: string;
  generation: number;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
}
export interface AccountsState extends CommerceState {
  accounts: Record<string, StoredAccount>;
  // Opaque session token -> session.
  sessions: Record<string, StoredSession>;
  // Global counter: every login, register and logout advances it.
  generation: number;
}
const invalidSession = () =>
  new ApiError(
    401,
    "SESSION_INVALID",
    "Sessão ausente, expirada ou revogada. Entre novamente.",
  );
// Session validity uses the real clock (7 days); controls expire it in tests.
export function activeSession(state: AccountsState, token: string | null) {
  const session = token ? state.sessions[token] : undefined;
  if (
    !session ||
    session.revokedAt ||
    Date.parse(session.expiresAt) <= Date.now() ||
    !state.accounts[session.userId]
  )
    throw invalidSession();
  return session;
}
export function viewSession(state: AccountsState, token: string): Session {
  const session = activeSession(state, token);
  const account = state.accounts[session.userId];
  return {
    id: session.id,
    user: {
      id: account.id,
      username: account.username,
      displayName: account.displayName,
      email: account.email,
    },
    expiresAt: session.expiresAt,
    generation: session.generation,
  };
}
function emptyCart(state: AccountsState, id: string): StoredCart {
  return {
    id,
    version: 1,
    items: [],
    coupon: null,
    updatedAt: logicalTime(state.tick),
  };
}
export function seedAccount(
  state: AccountsState,
  account: Omit<StoredAccount, "cartId" | "createdAt">,
) {
  const cartId = `cart-${account.id}`;
  state.carts[cartId] = emptyCart(state, cartId);
  state.accounts[account.id] = {
    ...account,
    createdAt: logicalTime(state.tick),
    cartId,
  };
}
function createSession(state: AccountsState, userId: string) {
  state.tick++;
  state.generation++;
  const token = `session-${crypto.randomUUID()}`;
  const now = Date.now();
  state.sessions[token] = {
    id: `sess-${state.tick}`,
    userId,
    generation: state.generation,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + sessionDurationMs).toISOString(),
    revokedAt: null,
  };
  return token;
}
// Merges the visitor cart into the user's cart once and consumes it, so a
// repeated login with the same visitor token cannot duplicate lines. Same
// edition: quantities add up with no capping (an excess shows as the usual
// conflict). Coupon: the visitor's wins when both exist (most recent intent).
function mergeVisitorCart(
  state: AccountsState,
  account: StoredAccount,
  visitorToken: string | null,
): CartMergeResult | null {
  const visitor = visitorToken ? state.visitors[visitorToken] : undefined;
  if (!visitorToken || !visitor) return null;
  const source = state.carts[visitor.cartId];
  const target = state.carts[account.cartId];
  delete state.visitors[visitorToken];
  delete state.carts[visitor.cartId];
  if (!source || (source.items.length === 0 && !source.coupon)) return null;
  state.tick++;
  let addedLines = 0;
  let mergedLines = 0;
  source.items.forEach((line, index) => {
    const existing = target.items.find(
      (i) => i.nftId === line.nftId && i.editionId === line.editionId,
    );
    if (existing) {
      existing.quantity += line.quantity;
      existing.acknowledgedPriceEth = line.acknowledgedPriceEth;
      mergedLines++;
    } else {
      target.items.push({ ...line, id: `item-${state.tick}-${index}` });
      addedLines++;
    }
  });
  target.coupon = source.coupon ?? target.coupon;
  target.version++;
  target.updatedAt = logicalTime(state.tick);
  return {
    addedLines,
    mergedLines,
    conflictLines: viewCart(state, target).items.filter((i) => i.conflict)
      .length,
    coupon: target.coupon,
  };
}
function strings(body: unknown) {
  const input = (body ?? {}) as Record<string, unknown>;
  const text = (key: string) =>
    typeof input[key] === "string" ? (input[key] as string) : "";
  return {
    username: text("username").trim().toLowerCase(),
    email: text("email").trim().toLowerCase(),
    password: text("password"),
  };
}
function authResult(
  state: AccountsState,
  account: StoredAccount,
  visitorToken: string | null,
) {
  const token = createSession(state, account.id);
  const merge = mergeVisitorCart(state, account, visitorToken);
  return { token, session: viewSession(state, token), merge };
}
export async function register(
  state: AccountsState,
  body: unknown,
  visitorToken: string | null,
) {
  const input = strings(body);
  const fields = registrationErrors(input);
  if (Object.keys(fields).length)
    throw new ApiError(
      400,
      "VALIDATION",
      "Revise os campos do cadastro.",
      fields,
    );
  const accounts = Object.values(state.accounts);
  const conflicts: Record<string, string> = {};
  if (accounts.some((a) => a.username === input.username))
    conflicts.username = "Este nome de usuário já está em uso.";
  if (accounts.some((a) => a.email === input.email))
    conflicts.email = "Este e-mail já está cadastrado.";
  if (Object.keys(conflicts).length)
    throw new ApiError(
      409,
      "CONFLICT",
      "Nome de usuário ou e-mail já cadastrado.",
      conflicts,
    );
  state.tick++;
  const id = `user-${state.tick}`;
  seedAccount(state, {
    id,
    username: input.username,
    email: input.email,
    displayName: null,
    password: await hashPassword(input.password),
  });
  return authResult(state, state.accounts[id], visitorToken);
}
// One generic answer for unknown e-mail and wrong password; an unknown e-mail
// still runs a derivation so timing does not reveal which case happened.
export async function login(
  state: AccountsState,
  body: unknown,
  visitorToken: string | null,
) {
  const input = strings(body);
  const account = Object.values(state.accounts).find(
    (a) => a.email === input.email,
  );
  const reference =
    account?.password ?? Object.values(state.accounts)[0]?.password;
  const valid = reference
    ? await verifyPassword(input.password, reference)
    : false;
  if (!account || !valid)
    throw new ApiError(
      401,
      "INVALID_CREDENTIALS",
      "E-mail ou senha incorretos.",
    );
  return authResult(state, account, visitorToken);
}
// Revokes the session; a revoked token never works again. Idempotent.
export function logout(state: AccountsState, token: string | null) {
  const session = token ? state.sessions[token] : undefined;
  if (!session || session.revokedAt) return;
  session.revokedAt = new Date().toISOString();
  state.generation++;
}
export function expireSession(state: AccountsState, token: string) {
  const session = state.sessions[token];
  if (!session) throw new Error("Unknown session");
  session.expiresAt = new Date(Date.now() - 1000).toISOString();
}
export function revokeSession(state: AccountsState, token: string) {
  const session = state.sessions[token];
  if (!session) throw new Error("Unknown session");
  session.revokedAt = new Date().toISOString();
}
export function accountCart(state: AccountsState, token: string | null) {
  const session = activeSession(state, token);
  return state.carts[state.accounts[session.userId].cartId];
}
