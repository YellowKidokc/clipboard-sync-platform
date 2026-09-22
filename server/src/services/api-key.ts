import { createHash, randomBytes } from "node:crypto";

const API_KEY_BYTES = 32;
const PREFIX = "csk_";

/**
 * API keys are 256 bits of CSPRNG output, so a SHA-256 of the key is enough to
 * store: there is nothing to brute-force the way there is with a password, and
 * bcrypt on every authenticated request would be a needless per-request cost.
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

export function generateApiKey(): { key: string; hash: string } {
  const key = `${PREFIX}${randomBytes(API_KEY_BYTES).toString("base64url")}`;
  return { key, hash: hashApiKey(key) };
}
