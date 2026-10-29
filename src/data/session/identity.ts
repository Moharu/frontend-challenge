import { useSyncExternalStore } from "react";
import axios, { type AxiosRequestConfig } from "axios";
import { http } from "@/lib/http";
import { queryClient } from "@/lib/query-client";
import { record } from "@/contracts/common";
import {
  isAuthResponse,
  isSession,
  sessionHeader,
  type AuthResponse,
  type Session,
} from "@/contracts/session";
import { notify } from "./notices";
// Client identity: the opaque session token (simulation only; production would
// use an HttpOnly cookie), the verified session and the visitor token. Only
// tokens are stored; cart and account data always come from the API.
export type SessionStatus = "checking" | "anonymous" | "authenticated";
export interface Identity {
  sessionToken: string | null;
  session: Session | null;
  visitorToken: string | null;
  status: SessionStatus;
}
// Private cache scope. null while a stored session is still being verified.
export type CartScope =
  | { kind: "visitor"; token: string | null }
  | { kind: "user"; userId: string; generation: number }
  | null;
const keys = { session: "kurio.session.v1", visitor: "kurio.visitor.v1" };
const memory: Record<string, string | null> = {};
function load(key: string) {
  try {
    return localStorage.getItem(key) ?? memory[key] ?? null;
  } catch {
    return memory[key] ?? null;
  }
}
function save(key: string, value: string | null) {
  memory[key] = value;
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // Memory fallback already holds the value.
  }
}
const storedSession = load(keys.session);
let state: Identity = {
  sessionToken: storedSession,
  session: null,
  visitorToken: load(keys.visitor),
  status: storedSession ? "checking" : "anonymous",
};
const listeners = new Set<() => void>();
function setState(patch: Partial<Identity>) {
  state = { ...state, ...patch };
  save(keys.session, state.sessionToken);
  save(keys.visitor, state.visitorToken);
  listeners.forEach((listener) => listener());
}
export const getIdentity = () => state;
export function subscribeIdentity(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export const useIdentity = () =>
  useSyncExternalStore(subscribeIdentity, getIdentity);
export function cartScope(identity: Identity = state): CartScope {
  if (identity.sessionToken)
    return identity.session
      ? {
          kind: "user",
          userId: identity.session.user.id,
          generation: identity.session.generation,
        }
      : null;
  return { kind: "visitor", token: identity.visitorToken };
}
export const sameScope = (a: CartScope, b: CartScope) =>
  JSON.stringify(a) === JSON.stringify(b);
export function setVisitorToken(token: string | null) {
  setState({ visitorToken: token });
}
// Headers for a private request made by the given identity snapshot.
export function identityHeaders(identity: Identity): Record<string, string> {
  if (identity.sessionToken)
    return { [sessionHeader]: `Bearer ${identity.sessionToken}` };
  return identity.visitorToken
    ? { "X-Visitor-Token": identity.visitorToken }
    : {};
}
// Private data of the previous identity: the new identity is published first
// (so re-renders and new requests already use it), then in-flight private
// requests are cancelled and their cache entries removed. Late responses land
// on removed keys of an older scope and are discarded.
async function clearPrivate() {
  await queryClient.cancelQueries({ queryKey: ["cart"] });
  queryClient.removeQueries({
    queryKey: ["cart"],
    predicate: (query) =>
      !sameScope(query.queryKey[1] as CartScope, cartScope()),
  });
}
const expiredListeners = new Set<() => void>();
export function onSessionExpired(listener: () => void) {
  expiredListeners.add(listener);
  return () => {
    expiredListeners.delete(listener);
  };
}
export async function signIn(response: AuthResponse) {
  setState({
    sessionToken: response.token,
    session: response.session,
    // The visitor cart was merged and consumed by the server.
    visitorToken: null,
    status: "authenticated",
  });
  await clearPrivate();
}
export async function signOut() {
  const token = state.sessionToken;
  setState({
    sessionToken: null,
    session: null,
    visitorToken: null,
    status: "anonymous",
  });
  await clearPrivate();
  // Revokes the token server-side; local sign-out never depends on it.
  if (token)
    await http
      .post("/session/logout", null, {
        headers: { [sessionHeader]: `Bearer ${token}` },
        skipSessionExpiry: true,
      } as AxiosRequestConfig)
      .catch(() => undefined);
  notify("Você saiu da sua conta.");
}
async function expire() {
  setState({
    sessionToken: null,
    session: null,
    visitorToken: null,
    status: "anonymous",
  });
  await clearPrivate();
  notify("Sua sessão expirou. Entre novamente para continuar.");
  expiredListeners.forEach((listener) => listener());
}
// A 401 SESSION_INVALID ends the local session only when the request used the
// current token; a late answer for an older token is ignored.
http.interceptors.response.use(undefined, (error: unknown) => {
  if (axios.isAxiosError(error) && error.response?.status === 401) {
    const body = error.response.data as unknown;
    const code =
      record(body) && record(body.error) ? body.error.code : undefined;
    const config = error.config as
      (AxiosRequestConfig & { skipSessionExpiry?: boolean }) | undefined;
    const sent = config?.headers?.[sessionHeader];
    if (
      code === "SESSION_INVALID" &&
      !config?.skipSessionExpiry &&
      state.sessionToken &&
      sent === `Bearer ${state.sessionToken}`
    )
      void expire();
  }
  return Promise.reject(error);
});
export async function login(email: string, password: string) {
  return authenticate("/session/login", { email, password });
}
export async function register(input: {
  username: string;
  email: string;
  password: string;
}) {
  return authenticate("/account/register", input);
}
async function authenticate(path: string, body: object) {
  const { data } = await http.post<unknown>(path, body, {
    headers: state.visitorToken
      ? { "X-Visitor-Token": state.visitorToken }
      : {},
  });
  if (!record(data) || !isAuthResponse(data.data))
    throw new Error("Invalid authentication response");
  await signIn(data.data);
  return data.data;
}
// Verifies a stored session without blocking rendering. 401 clears it
// silently; transient failures retry on focus/online, keeping the header in
// its neutral state meanwhile.
let checking: Promise<void> | null = null;
export function verifySession() {
  const token = state.sessionToken;
  if (!token || state.session) return Promise.resolve();
  checking ??= http
    .get<unknown>("/session", {
      headers: { [sessionHeader]: `Bearer ${token}` },
      skipSessionExpiry: true,
    } as AxiosRequestConfig)
    .then(({ data }) => {
      if (state.sessionToken !== token) return;
      if (!record(data) || !isSession(data.data))
        throw new Error("Invalid session response");
      setState({ session: data.data, status: "authenticated" });
    })
    .catch((error: unknown) => {
      if (state.sessionToken !== token) return;
      if (axios.isAxiosError(error) && error.response?.status === 401)
        setState({ sessionToken: null, session: null, status: "anonymous" });
    })
    .finally(() => {
      checking = null;
    });
  return checking;
}
if (typeof window !== "undefined") {
  const retry = () => {
    if (state.status === "checking") void verifySession();
  };
  window.addEventListener("focus", retry);
  window.addEventListener("online", retry);
}
