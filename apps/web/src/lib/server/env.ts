/**
 * Central access to the server-side environment variables used by the VPN API
 * client. Nothing here is hardcoded per environment — values come from
 * .env.local (see .env.example) or the hosting provider's dashboard.
 */

const TRAILING_SLASH = /\/$/;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing required environment variable "${name}". ` +
        `Copy apps/web/.env.example to apps/web/.env.local and fill it in.`,
    );
  }
  return value;
}

/**
 * Base URL of the exit-node API (including the /api prefix).
 * Defaults to the local dev server outside production.
 */
export function getVpnApiUrl(): string {
  const configured = process.env.VPN_API_URL?.trim();
  if (configured) {
    return configured.replace(TRAILING_SLASH, "");
  }
  if (process.env.NODE_ENV !== "production") {
    return "http://127.0.0.1:3001/api";
  }
  throw new Error(
    "VPN_API_URL is not set. Point it at the exit-node API, " +
      "e.g. https://api.yourdomain.com/api",
  );
}

/** HMAC secret used to sign requests sent to the exit-node API. */
export function getBackendApiSecret(): string {
  return required("BACKEND_API_SECRET");
}

/** Browser origin allowed to call /api/vpn/peer/create. */
export function getCorsAllowedOrigin(): string {
  return (
    process.env.CORS_ALLOWED_ORIGIN?.trim() || "http://localhost:5173"
  );
}
