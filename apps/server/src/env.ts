/**
 * Fail-fast environment configuration for the exit-node server.
 *
 * Every variable the server needs is validated once at startup so a missing
 * secret produces a clear crash instead of "500 authentication is not
 * configured" at runtime.
 *
 * Local dev:  copy apps/server/.env.example to apps/server/.env
 * Production: /etc/metro-vpn/exit-node.env (see deployment/vpn-exit-node.service)
 */

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing required environment variable "${name}". ` +
        `Copy apps/server/.env.example to apps/server/.env (local dev) ` +
        `or create /etc/metro-vpn/exit-node.env on the host (production).`,
    );
  }
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

const port = Number(optional("PORT") ?? 3001);
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`Invalid PORT "${process.env.PORT}" — expected 1-65535.`);
}

export const env = {
  port,
  /** HMAC secret shared with apps/web for request signing. */
  backendApiSecret: required("BACKEND_API_SECRET"),
  /** Public `ip:51820` written into client configs. Auto-detected if unset. */
  wgEndpoint: optional("WG_ENDPOINT"),
  /** Interface used for NAT masquerade. Auto-detected if unset. */
  wgWanInterface: optional("WG_WAN_INTERFACE"),
  /** Fallback WireGuard server public key (wg0.conf key is preferred). */
  wgServerPublicKey: optional("WG_SERVER_PUBLIC_KEY"),
  nodeEnv: optional("NODE_ENV") ?? "development",
};
