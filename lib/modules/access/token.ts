// Invite tokens: the raw token goes in the link, only its SHA-256 hash is stored.
import { createHash, randomBytes } from "node:crypto";

export function newInviteToken() {
  return randomBytes(24).toString("base64url");
}

/** Same as Postgres encode(sha256(token::bytea), 'hex'), so seeds can store a known hash. */
export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
