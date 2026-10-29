import { redirect, type ParsedLocation } from "@tanstack/react-router";
import { getIdentity, verifySession } from "@/data/session/identity";
// A stored session that could not be verified (503 or network failure on
// `GET /session`): the user may well be signed in, so this is neither a
// sign-out nor a reason to drop the token. Private routes show a retry state
// (`SessionCheckError`) instead of the login.
export class SessionUnconfirmed extends Error {
  constructor() {
    super("Session could not be confirmed");
    this.name = "SessionUnconfirmed";
  }
}
// Reusable guard for private routes (checkout, profile, wallets, favorites,
// orders in the next stages). Three cases after waiting for the verification:
// authenticated goes on; confirmed anonymous goes to the login with the
// current location as target; still unverified (transient failure) throws
// `SessionUnconfirmed` for the route's error component.
export async function requireSession({
  location,
}: {
  location: ParsedLocation;
}) {
  await verifySession();
  const { status } = getIdentity();
  if (status === "authenticated") return;
  if (status === "checking") throw new SessionUnconfirmed();
  throw redirect({
    to: "/login",
    search: { redirect: location.href },
  });
}
// Login/signup are not shown to an authenticated user: they go to the target.
// An unverified stored session (transient failure) is not treated as signed
// in or out: the login renders normally and the user may simply sign in.
export async function redirectAuthenticated({
  search,
}: {
  search: { redirect: string };
}) {
  await verifySession();
  if (getIdentity().status === "authenticated")
    throw redirect({ href: search.redirect });
}
