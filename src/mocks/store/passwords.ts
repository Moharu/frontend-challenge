// Passwords are never stored in clear: PBKDF2-SHA256 via Web Crypto with a
// random 16-byte salt per account and a 256-bit derived key.
export const pbkdf2Iterations = 100_000;
export interface PasswordHash {
  algorithm: "PBKDF2-SHA256";
  iterations: number;
  salt: string;
  hash: string;
}
const encoder = new TextEncoder();
const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text: string) =>
  Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
async function derive(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}
export async function hashPassword(password: string): Promise<PasswordHash> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, pbkdf2Iterations);
  return {
    algorithm: "PBKDF2-SHA256",
    iterations: pbkdf2Iterations,
    salt: toBase64(salt),
    hash: toBase64(hash),
  };
}
export async function verifyPassword(password: string, stored: PasswordHash) {
  const derived = await derive(
    password,
    fromBase64(stored.salt),
    stored.iterations,
  );
  const expected = fromBase64(stored.hash);
  // Compare every byte so timing does not reveal the matching prefix.
  let difference = derived.length ^ expected.length;
  for (let i = 0; i < expected.length; i++)
    difference |= derived[i] ^ expected[i];
  return difference === 0;
}
