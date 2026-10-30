import { integer, record } from "./common";
import { emailPattern, passwordErrors, usernamePattern } from "./session";
import { ensNamePattern } from "./wallets";
export interface Profile {
  userId: string;
  displayName: string | null;
  username: string;
  email: string;
  ensName: string | null;
  walletNickname: string | null;
  bio: string | null;
  avatar: string | null;
  version: number;
}
export interface UpdateProfileRequest {
  version: number;
  username?: string;
  email?: string;
  displayName?: string | null;
  ensName?: string | null;
  walletNickname?: string | null;
  bio?: string | null;
}
export interface UpdateAvatarRequest {
  dataUrl: string | null;
  version: number;
}
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
export const profileTextMax = 60;
export const bioMax = 500;
// Avatar: the browser crops it to a 256×256 square and re-encodes it (WebP,
// JPEG as fallback) before sending; the server accepts only these image data
// URLs, up to 150 KB once decoded. The source file chosen in the browser may
// have up to 5 MB.
export const avatarSize = 256;
export const avatarMaxBytes = 150 * 1024;
export const avatarSourceMaxBytes = 5 * 1024 * 1024;
export const avatarTypes = ["image/webp", "image/jpeg", "image/png"];
const avatarDataUrl =
  /^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/;
// Decoded size of a base64 payload, without decoding it.
const base64Bytes = (payload: string) =>
  Math.floor((payload.length * 3) / 4) -
  (payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0);
export function avatarError(dataUrl: string): string | null {
  const match = avatarDataUrl.exec(dataUrl);
  if (!match) return "Use uma imagem WebP, JPEG ou PNG.";
  if (base64Bytes(match[2]) > avatarMaxBytes)
    return `A imagem deve ter no máximo ${avatarMaxBytes / 1024} KB.`;
  return null;
}
// Shared by the simulated server and the profile form. Only the fields
// present are checked (a PATCH validates what it changes): username and
// e-mail as in the sign-up, the ENS name as a full `.eth` name.
export function profileErrors(input: {
  username?: string;
  email?: string;
  displayName?: string | null;
  ensName?: string | null;
  walletNickname?: string | null;
  bio?: string | null;
}): Record<string, string> {
  const fields: Record<string, string> = {};
  if (
    input.username !== undefined &&
    !usernamePattern.test(input.username.trim().toLowerCase())
  )
    fields.username =
      "Use de 3 a 20 caracteres: letras sem acento, números ou _.";
  if (input.email !== undefined && !emailPattern.test(input.email.trim()))
    fields.email = "Informe um e-mail válido.";
  for (const key of ["displayName", "walletNickname"] as const) {
    const value = input[key]?.trim();
    if (value && value.length > profileTextMax)
      fields[key] = `Use no máximo ${profileTextMax} caracteres.`;
  }
  const ens = input.ensName?.trim();
  if (ens && !ensNamePattern.test(ens))
    fields.ensName = "Use um nome .eth válido, por exemplo ada.eth.";
  if (input.bio && input.bio.length > bioMax)
    fields.bio = `Use no máximo ${bioMax} caracteres.`;
  return fields;
}
// The new password follows the sign-up rule; the confirmation is checked
// only in the browser and never sent.
export const newPasswordError = (password: string) => passwordErrors(password);
const optionalText = (value: unknown) =>
  value === null || typeof value === "string";
export function isProfile(value: unknown): value is Profile {
  return (
    record(value) &&
    typeof value.userId === "string" &&
    typeof value.username === "string" &&
    typeof value.email === "string" &&
    ["displayName", "ensName", "walletNickname", "bio", "avatar"].every((key) =>
      optionalText(value[key]),
    ) &&
    integer(value.version, 1)
  );
}
