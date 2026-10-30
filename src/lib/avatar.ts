import {
  avatarError,
  avatarSize,
  avatarSourceMaxBytes,
  avatarTypes,
} from "@/contracts/profile";
export class AvatarError extends Error {}
// Prepares an avatar in the browser before sending: a centered square crop,
// 256×256, re-encoded as WebP (JPEG where the browser cannot encode WebP),
// lowering the quality until it fits the server limit.
export async function prepareAvatar(file: File): Promise<string> {
  if (!avatarTypes.includes(file.type))
    throw new AvatarError("Escolha uma imagem WebP, JPEG ou PNG.");
  if (file.size > avatarSourceMaxBytes)
    throw new AvatarError(
      `A imagem deve ter no máximo ${avatarSourceMaxBytes / 1024 / 1024} MB.`,
    );
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new AvatarError("Não foi possível ler esta imagem.");
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = avatarSize;
  canvas.height = avatarSize;
  const context = canvas.getContext("2d");
  if (!context) throw new AvatarError("Não foi possível processar a imagem.");
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    avatarSize,
    avatarSize,
  );
  bitmap.close();
  for (const quality of [0.9, 0.8, 0.65, 0.5, 0.35]) {
    let url = canvas.toDataURL("image/webp", quality);
    if (!url.startsWith("data:image/webp"))
      url = canvas.toDataURL("image/jpeg", quality);
    if (!avatarError(url)) return url;
  }
  throw new AvatarError("Não foi possível reduzir a imagem ao tamanho aceito.");
}
