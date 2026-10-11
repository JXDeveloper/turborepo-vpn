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

import path from "node:path";

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

function optionalBoolean(name: string, fallback: boolean): boolean {
  const value = optional(name);
  if (value === undefined) return fallback;
  if (["1", "true", "yes", "on"].includes(value.toLowerCase())) return true;
  if (["0", "false", "no", "off"].includes(value.toLowerCase())) return false;
  throw new Error(
    `Invalid ${name} "${value}" — expected one of true/false/1/0/yes/no/on/off.`,
  );
}

const port = Number(optional("PORT") ?? 3001);
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`Invalid PORT "${process.env.PORT}" — expected 1-65535.`);
}

const nodeEnv = optional("NODE_ENV") ?? "development";

/**
 * Where wg0.conf lives.
 *
 * In production this MUST point outside the release directory
 * (`/opt/releases/<sha>`, see .github/workflows/deploy-exit-node_ec2.yml):
 * every deploy ships a fresh directory, so keeping the config inside it means a
 * brand-new server keypair and zero peers after each release.
 */
const wgConfigPath =
  optional("WG_CONFIG_PATH") ?? path.join(process.cwd(), "configs", "wg0.conf");

/**
 * The interface name is always derived from the config file name, exactly like
 * `wg-quick` does — wg-quick creates `<basename>.conf` -> `<basename>`, so a
 * separately configurable name could only desynchronise `wg set` from reality.
 */
const wgInterface = path.basename(wgConfigPath).replace(/\.conf$/i, "");
if (!/^[a-zA-Z0-9_=+.-]{1,15}$/.test(wgInterface)) {
  throw new Error(
    `WG_CONFIG_PATH "${wgConfigPath}" does not end in a valid interface name ` +
      `(expected <name>.conf where <name> is 1-15 chars of [a-zA-Z0-9_=+.-]).`,
  );
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
  /** Absolute path of the WireGuard config the server manages. */
  wgConfigPath,
  /** Kernel interface managed by `wgConfigPath` (wg-quick naming rule). */
  wgInterface,
  /**
   * Bring wg0 up automatically on boot (and reconcile its peers). Defaults to
   * on in production so a reboot or a deploy restores the data plane without
   * anyone clicking "turn tunnel on"; off in dev because it needs root.
   */
  wgAutoUp: optionalBoolean("WG_AUTO_UP", nodeEnv === "production"),
  nodeEnv,
};
