const MIN_JWT_SECRET_LENGTH = 32;

/** Values that show up in copied-around .env files and are not secrets. */
const PLACEHOLDER_SECRETS = new Set([
  "change-me",
  "changeme",
  "change_me",
  "dev-secret",
  "devsecret",
  "your-secret-here",
  "your-secret",
  "secret",
  "password",
  "test",
  "xxx"
]);

function requireJwtSecret(): string {
  const value = process.env.JWT_SECRET;
  if (!value) {
    throw new Error("JWT_SECRET is required. Generate one with: openssl rand -hex 32");
  }
  if (PLACEHOLDER_SECRETS.has(value.trim().toLowerCase())) {
    throw new Error(`JWT_SECRET is set to the placeholder "${value}". Generate one with: openssl rand -hex 32`);
  }
  if (value.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters (got ${value.length}). Generate one with: openssl rand -hex 32`
    );
  }
  return value;
}

function splitList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export const jwtSecret = requireJwtSecret();

/**
 * Origins allowed to make browser requests. Empty by default: the production
 * image serves the PWA from the same origin as the API, so no CORS headers are
 * needed. Set CORS_ORIGIN=http://localhost:5173 when running the Vite dev
 * server against this API.
 */
export const corsOrigins = splitList(process.env.CORS_ORIGIN);

/**
 * Hostnames webhook rules may target even though they resolve to a private
 * address — a self-hosted n8n or Home Assistant on the LAN, for example.
 * Everything else is blocked from reaching private address space.
 */
export const webhookAllowedHosts = splitList(process.env.WEBHOOK_ALLOWED_HOSTS).map((host) => host.toLowerCase());
