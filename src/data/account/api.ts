import { http } from "@/lib/http";
import { record } from "@/contracts/common";
import { isFavorite, type Favorite } from "@/contracts/favorites";
import {
  isProfile,
  type ChangePasswordRequest,
  type Profile,
  type UpdateAvatarRequest,
  type UpdateProfileRequest,
} from "@/contracts/profile";
import {
  isWallet,
  type UpdateWalletRequest,
  type Wallet,
} from "@/contracts/wallets";
import { getIdentity, identityHeaders } from "@/data/session/identity";
// Private account requests carry the current session token; a 401
// SESSION_INVALID goes through the usual expiry flow (see identity.ts).
const headers = () => identityHeaders(getIdentity());
function data<T>(value: unknown, valid: (v: unknown) => v is T, what: string) {
  if (!record(value) || !valid(value.data))
    throw new Error(`Invalid ${what} response`);
  return value.data;
}
export async function getProfile(signal?: AbortSignal): Promise<Profile> {
  const { data: value } = await http.get<unknown>("/profile", {
    headers: headers(),
    signal,
  });
  return data(value, isProfile, "profile");
}
export async function updateProfile(body: UpdateProfileRequest) {
  const { data: value } = await http.patch<unknown>("/profile", body, {
    headers: headers(),
  });
  return data(value, isProfile, "profile");
}
export async function updateAvatar(body: UpdateAvatarRequest) {
  const { data: value } = await http.put<unknown>("/profile/avatar", body, {
    headers: headers(),
  });
  return data(value, isProfile, "profile");
}
export async function changePassword(body: ChangePasswordRequest) {
  await http.put("/profile/password", body, { headers: headers() });
}
export async function updateWallet(id: string, body: UpdateWalletRequest) {
  const { data: value } = await http.patch<unknown>(
    `/wallets/${encodeURIComponent(id)}`,
    body,
    { headers: headers() },
  );
  return data(value, isWallet, "wallet") as Wallet;
}
export async function getFavorites(signal?: AbortSignal): Promise<Favorite[]> {
  const { data: value } = await http.get<unknown>("/favorites", {
    headers: headers(),
    signal,
  });
  return data(
    value,
    (v): v is Favorite[] => Array.isArray(v) && v.every(isFavorite),
    "favorites",
  );
}
export async function addFavorite(nftId: string) {
  await http.post("/favorites", { nftId }, { headers: headers() });
}
export async function removeFavorite(nftId: string) {
  await http.delete(`/favorites/${encodeURIComponent(nftId)}`, {
    headers: headers(),
  });
}
