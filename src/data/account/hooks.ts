import { useQuery } from "@tanstack/react-query";
import type { Favorite } from "@/contracts/favorites";
import type { Profile } from "@/contracts/profile";
import { queryClient } from "@/lib/query-client";
import { apiError } from "@/lib/api-error";
import {
  cartScope,
  sameScope,
  useIdentity,
  type CartScope,
} from "@/data/session/identity";
import { notify } from "@/data/session/notices";
import { addFavorite, getFavorites, getProfile, removeFavorite } from "./api";
// Profile and favorites are private data in the same user + generation scope
// as the cart and wallets: logout, expiry and user switches drop them.
export const profileKey = (scope: CartScope) => ["profile", scope] as const;
export const favoritesKey = (scope: CartScope) => ["favorites", scope] as const;
export function useProfile() {
  const scope = cartScope(useIdentity());
  return useQuery<Profile>({
    queryKey: profileKey(scope),
    queryFn: ({ signal }) => getProfile(signal),
    enabled: scope?.kind === "user",
    retry: false,
  });
}
export function useFavorites() {
  const scope = cartScope(useIdentity());
  return useQuery<Favorite[]>({
    queryKey: favoritesKey(scope),
    queryFn: ({ signal }) => getFavorites(signal),
    enabled: scope?.kind === "user",
    retry: false,
  });
}
// Optimistic favorites. Per NFT: the cache changes at once with each click;
// requests are sent one at a time, and only the latest intent is sent (rapid
// clicks never race each other). On failure the cache returns to the state
// the server last confirmed and the error is announced; when nothing is left
// pending, the list is reconciled with the API.
interface Track {
  // Latest intent (true = favorite) and the server's confirmed state.
  intent: boolean;
  confirmed: boolean;
  chain: Promise<void>;
  pending: number;
  // State before the first of these clicks, and whether a request failed:
  // one announcement when the clicks settle.
  initial: boolean;
  failed: boolean;
}
const tracks = new Map<string, Track>();
const trackKey = (scope: CartScope, nftId: string) =>
  `${JSON.stringify(scope)}:${nftId}`;
function setFavorite(scope: CartScope, nftId: string, on: boolean) {
  queryClient.setQueryData<Favorite[]>(favoritesKey(scope), (current = []) => {
    const has = current.some((f) => f.nftId === nftId);
    if (on === has) return current;
    return on
      ? [{ nftId, createdAt: new Date().toISOString() }, ...current]
      : current.filter((f) => f.nftId !== nftId);
  });
}
export async function toggleFavorite(nftId: string, name: string) {
  const scope = cartScope();
  if (scope?.kind !== "user") return;
  const key = favoritesKey(scope);
  // 1. Pending reads would overwrite the optimistic value.
  await queryClient.cancelQueries({ queryKey: key });
  const list = queryClient.getQueryData<Favorite[]>(key) ?? [];
  const current = list.some((f) => f.nftId === nftId);
  const id = trackKey(scope, nftId);
  // 2. The previous state: what the server confirmed (kept across clicks).
  const track = tracks.get(id) ?? {
    intent: current,
    confirmed: current,
    chain: Promise.resolve(),
    pending: 0,
    initial: current,
    failed: false,
  };
  tracks.set(id, track);
  const intent = !current;
  track.intent = intent;
  track.pending++;
  // 3. The cache changes immediately.
  setFavorite(scope, nftId, intent);
  // 4. Requests run in order; a superseded intent is skipped.
  track.chain = track.chain.then(async () => {
    if (track.intent !== intent || track.confirmed === intent) return;
    try {
      if (intent) await addFavorite(nftId);
      else await removeFavorite(nftId);
      track.confirmed = intent;
    } catch (error) {
      // 5. Roll back (unless a newer click already changed the intent).
      if (track.intent === intent && sameScope(scope, cartScope())) {
        track.failed = true;
        track.intent = track.confirmed;
        setFavorite(scope, nftId, track.confirmed);
        const info = apiError(error);
        if (info.status !== 401)
          notify(
            intent
              ? `Não foi possível favoritar ${name}. Tente novamente.`
              : `Não foi possível remover ${name} dos favoritos. Tente novamente.`,
          );
      }
    }
  });
  await track.chain;
  track.pending--;
  // 6. Reconcile with the API once nothing is left pending.
  if (track.pending === 0) {
    tracks.delete(id);
    if (!sameScope(scope, cartScope())) return;
    if (!track.failed && track.confirmed !== track.initial)
      notify(
        track.confirmed
          ? `${name} adicionado aos favoritos.`
          : `${name} removido dos favoritos.`,
      );
    await queryClient.invalidateQueries({ queryKey: key });
  }
}
