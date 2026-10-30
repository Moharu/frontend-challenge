import { record } from "@/contracts/common";
import type { Favorite } from "@/contracts/favorites";
import {
  avatarError,
  newPasswordError,
  profileErrors,
  type Profile,
} from "@/contracts/profile";
import { activeSession, type StoredAccount } from "./accounts";
import { ApiError } from "./cart";
import { hashPassword, verifyPassword } from "./passwords";
import type { OrdersState } from "./orders";
export interface ProfileState extends OrdersState {
  // userId -> favorites, most recent first.
  favorites: Record<string, Favorite[]>;
}
const accountOf = (state: ProfileState, token: string | null) =>
  state.accounts[activeSession(state, token).userId];
export const viewProfile = (account: StoredAccount): Profile => ({
  userId: account.id,
  displayName: account.displayName,
  username: account.username,
  email: account.email,
  ensName: account.ensName,
  walletNickname: account.walletNickname,
  bio: account.bio,
  avatar: account.avatar,
  version: account.profileVersion,
});
export const getProfile = (state: ProfileState, token: string | null) =>
  viewProfile(accountOf(state, token));
// Every profile write names the version it was based on: an older one is a
// 409, so two tabs never overwrite each other silently.
function checkVersion(account: StoredAccount, version: unknown) {
  if (typeof version !== "number")
    throw new ApiError(400, "VALIDATION", "Informe a versão do perfil.");
  if (version !== account.profileVersion)
    throw new ApiError(
      409,
      "CONFLICT",
      "O perfil foi alterado em outro lugar. Recarregue os dados e tente novamente.",
    );
}
const nullable = ["displayName", "ensName", "walletNickname", "bio"] as const;
// Omitted fields keep their value; null clears only the nullable ones;
// username and e-mail never accept null.
export function updateProfile(
  state: ProfileState,
  token: string | null,
  body: unknown,
): Profile {
  const account = accountOf(state, token);
  const input = record(body) ? body : {};
  checkVersion(account, input.version);
  const fields: Record<string, string> = {};
  for (const key of ["username", "email"] as const)
    if (key in input && typeof input[key] !== "string")
      fields[key] =
        key === "username" ? "Informe o nome de usuário." : "Informe o e-mail.";
  for (const key of nullable)
    if (key in input && input[key] !== null && typeof input[key] !== "string")
      fields[key] = "Valor inválido.";
  const patch = {
    username:
      typeof input.username === "string"
        ? input.username.trim().toLowerCase()
        : undefined,
    email:
      typeof input.email === "string"
        ? input.email.trim().toLowerCase()
        : undefined,
    ...Object.fromEntries(
      nullable
        .filter((key) => key in input)
        .map((key) => [
          key,
          typeof input[key] === "string" && (input[key] as string).trim()
            ? (input[key] as string).trim()
            : null,
        ]),
    ),
  } as Partial<
    Pick<StoredAccount, "username" | "email" | (typeof nullable)[number]>
  >;
  Object.assign(fields, profileErrors(patch));
  if (Object.keys(fields).length)
    throw new ApiError(400, "VALIDATION", "Revise os dados do perfil.", fields);
  const others = Object.values(state.accounts).filter(
    (a) => a.id !== account.id,
  );
  const conflicts: Record<string, string> = {};
  if (patch.username && others.some((a) => a.username === patch.username))
    conflicts.username = "Este nome de usuário já está em uso.";
  if (patch.email && others.some((a) => a.email === patch.email))
    conflicts.email = "Este e-mail já está cadastrado.";
  if (Object.keys(conflicts).length)
    throw new ApiError(
      409,
      "CONFLICT",
      "Nome de usuário ou e-mail já em uso.",
      conflicts,
    );
  for (const [key, value] of Object.entries(patch))
    if (value !== undefined)
      (account as unknown as Record<string, unknown>)[key] = value;
  account.profileVersion++;
  return viewProfile(account);
}
export function updateAvatar(
  state: ProfileState,
  token: string | null,
  body: unknown,
): Profile {
  const account = accountOf(state, token);
  const input = record(body) ? body : {};
  checkVersion(account, input.version);
  if (input.dataUrl !== null) {
    const problem =
      typeof input.dataUrl === "string"
        ? avatarError(input.dataUrl)
        : "Envie a imagem do avatar.";
    if (problem)
      throw new ApiError(400, "VALIDATION", "Avatar inválido.", {
        avatar: problem,
      });
  }
  account.avatar = input.dataUrl as string | null;
  account.profileVersion++;
  return viewProfile(account);
}
// The current password is checked against the stored hash; the new one gets
// a new salt. The session that changed it stays valid; the user's other
// sessions are revoked (a changed password signs out other devices).
export async function changePassword(
  state: ProfileState,
  token: string | null,
  body: unknown,
) {
  const session = activeSession(state, token);
  const account = state.accounts[session.userId];
  const input = record(body) ? body : {};
  const current =
    typeof input.currentPassword === "string" ? input.currentPassword : "";
  const next = typeof input.newPassword === "string" ? input.newPassword : "";
  if (!(await verifyPassword(current, account.password)))
    throw new ApiError(400, "VALIDATION", "Senha atual incorreta.", {
      currentPassword: "A senha atual está incorreta.",
    });
  const problem = newPasswordError(next);
  if (problem)
    throw new ApiError(400, "VALIDATION", "Revise a nova senha.", {
      newPassword: problem,
    });
  account.password = await hashPassword(next);
  const now = new Date().toISOString();
  for (const other of Object.values(state.sessions))
    if (
      other.userId === account.id &&
      other.id !== session.id &&
      !other.revokedAt
    )
      other.revokedAt = now;
}
export function listFavorites(state: ProfileState, token: string | null) {
  return structuredClone(
    state.favorites[activeSession(state, token).userId] ?? [],
  );
}
// Idempotent: favoriting twice keeps one entry (and its first date).
export function addFavorite(
  state: ProfileState,
  token: string | null,
  body: unknown,
  now: string,
): Favorite {
  const userId = activeSession(state, token).userId;
  const nftId =
    record(body) && typeof body.nftId === "string" ? body.nftId : "";
  if (!state.nfts.some((n) => n.id === nftId))
    throw new ApiError(404, "NOT_FOUND", "NFT não encontrado.");
  const list = (state.favorites[userId] ??= []);
  const existing = list.find((f) => f.nftId === nftId);
  if (existing) return { ...existing };
  const favorite = { nftId, createdAt: now };
  list.unshift(favorite);
  return { ...favorite };
}
// Idempotent as well: removing a favorite that is not there is a no-op.
export function removeFavorite(
  state: ProfileState,
  token: string | null,
  nftId: string,
) {
  const userId = activeSession(state, token).userId;
  if (!state.nfts.some((n) => n.id === nftId))
    throw new ApiError(404, "NOT_FOUND", "NFT não encontrado.");
  state.favorites[userId] = (state.favorites[userId] ?? []).filter(
    (f) => f.nftId !== nftId,
  );
}
