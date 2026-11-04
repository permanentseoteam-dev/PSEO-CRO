// API key creation and hashing (Node crypto). The full key is returned once and never stored.
import { createHash, randomBytes } from "node:crypto";

const ALNUM = "abcdefghijklmnopqrstuvwxyz0123456789";

/** "pk_ab12cd_<43 url-safe chars>". The "pk_ab12cd" part is the display prefix kept in the table. */
export function generateApiKey() {
  const bytes = randomBytes(6);
  const prefix = "pk_" + Array.from(bytes, (b) => ALNUM[b % ALNUM.length]).join("");
  const key = `${prefix}_${randomBytes(32).toString("base64url")}`;
  return { key, prefix, hash: hashApiKey(key) };
}

/** SHA-256 hex. Keys carry 256 bits of randomness, so a fast hash is enough (no salt or slow KDF needed). */
export function hashApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export function prefixOf(key: string) {
  return key.slice(0, 9);
}
