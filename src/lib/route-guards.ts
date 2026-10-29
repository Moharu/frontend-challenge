import { redirect, type ParsedLocation } from "@tanstack/react-router";
import { getIdentity, verifySession } from "@/data/session/identity";
// Reusable guard for private routes (checkout, profile, wallets, favorites,
// orders in the next stages): waits for a stored session to be verified and
// sends anonymous users to the login with the current location as target.
export async function requireSession({
  location,
}: {
  location: ParsedLocation;
}) {
  await verifySession();
  if (getIdentity().status !== "authenticated")
    throw redirect({
      to: "/login",
      search: { redirect: location.href },
    });
}
// Login/signup are not shown to an authenticated user: they go to the target.
export async function redirectAuthenticated({
  search,
}: {
  search: { redirect: string };
}) {
  await verifySession();
  if (getIdentity().status === "authenticated")
    throw redirect({ href: search.redirect });
}
