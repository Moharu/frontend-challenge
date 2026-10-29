// Prints the stored form of a demo password (salt + PBKDF2 hash) for the seed.
// Usage: node scripts/hash-password.mjs <password>
import { hashPassword } from "../src/mocks/store/passwords.ts";
const password = process.argv[2];
if (!password)
  throw new Error("Usage: node scripts/hash-password.mjs <password>");
console.log(JSON.stringify(await hashPassword(password), null, 2));
