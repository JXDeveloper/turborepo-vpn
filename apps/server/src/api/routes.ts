import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { verifySignature } from "@my-vpn/crypto-utils";
import { Context, Hono, type Handler, type Next } from "hono";
import { createMiddleware } from "hono/factory";
import { WgConfig } from "@shurahbil/wireguard-tools-2";
import { env } from "../env.js";
import {
  bringDown,
  bringUp,
  enableIpForward,
  interfaceExists,
  readInterface,
  readIpForward,
  reconcilePeers,
  removePeer,
  setPeer,
  WgCommandError,
  type DesiredPeer,
  type InterfaceState,
} from "../wg/runtime.js";

const DEFAULT_WG_PORT = 51820;

/** Where clients should send their UDP packets. */
export interface EndpointInfo {
  endpoint: string;
  source: "env" | "imds" | "public-interface" | "private-interface" | "loopback";
  /** Present when the endpoint is very likely unreachable from the internet. */
  warning?: string;
}

let endpointCache: EndpointInfo | null = null;

function isPublicIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((n) => Number.isNaN(n))) return false;
  const [a, b] = octets;
  if (a === 10) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 169 && b === 254) return false;
  if (a === 127) return false;
  if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
  return a >= 1 && a <= 223;
}

/** EC2 instance metadata (IMDSv2, falling back to IMDSv1). */
async function fetchEc2Metadata(pathname: string): Promise<string | null> {
  const headers: Record<string, string> = {};
  try {
    const tokenResponse = await fetch(
      "http://169.254.169.254/latest/api/token",
      {
        method: "PUT",
        headers: { "X-aws-ec2-metadata-token-ttl-seconds": "60" },
        signal: AbortSignal.timeout(700),
      },
    );
    if (tokenResponse.ok) {
      headers["X-aws-ec2-metadata-token"] = (await tokenResponse.text()).trim();
    }
  } catch {
    // Not an EC2 host, or IMDSv1-only: try the plain request below.
  }

  try {
    const response = await fetch(`http://169.254.169.254${pathname}`, {
      headers,
      signal: AbortSignal.timeout(700),
    });
    if (!response.ok) return null;
    return (await response.text()).trim() || null;
  } catch {
    return null;
  }
}

async function detectEndpoint(): Promise<EndpointInfo> {
  const publicIpv4 = await fetchEc2Metadata("/latest/meta-data/public-ipv4");
  if (publicIpv4 && isPublicIpv4(publicIpv4)) {
    return { endpoint: `${publicIpv4}:${DEFAULT_WG_PORT}`, source: "imds" };
  }

  const candidates: string[] = [];
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const iface of interfaces ?? []) {
      if (iface.internal || iface.family !== "IPv4") continue;
      candidates.push(iface.address);
    }
  }

  const publicAddress = candidates.find(isPublicIpv4);
  if (publicAddress) {
    return { endpoint: `${publicAddress}:${DEFAULT_WG_PORT}`, source: "public-interface" };
  }

  const privateAddress = candidates.find((address) => !address.startsWith("172.17."));
  if (privateAddress) {
    return {
      endpoint: `${privateAddress}:${DEFAULT_WG_PORT}`,
      source: "private-interface",
      warning:
        `WG_ENDPOINT is not set and the auto-detected endpoint "${privateAddress}:${DEFAULT_WG_PORT}" ` +
        `is a private address — clients on the internet cannot reach it. ` +
        `Set WG_ENDPOINT=<ec2-public-ip>:${DEFAULT_WG_PORT} in /etc/metro-vpn/exit-node.env.`,
    };
  }

  return {
    endpoint: `127.0.0.1:${DEFAULT_WG_PORT}`,
    source: "loopback",
    warning: "WG_ENDPOINT is not set and no network interface could be detected.",
  };
}

/**
 * Public `ip:port` written into client configs. Resolved once and cached so we
 * hit the instance metadata at most a single time per process.
 */
export async function resolveEndpoint(): Promise<EndpointInfo> {
  if (env.wgEndpoint) {
    return { endpoint: env.wgEndpoint, source: "env" };
  }
  if (!endpointCache) {
    endpointCache = await detectEndpoint();
    if (endpointCache.warning) {
      console.warn(`[wireguard] ${endpointCache.warning}`);
    }
  }
  return endpointCache;
}

function getDefaultWanInterface(): string {
  if (env.wgWanInterface) {
    return env.wgWanInterface;
  }
  try {
    const routeOutput = execSync("ip route show default", {
      encoding: "utf-8",
    });
    const match = routeOutput.match(/dev\s+([^\s]+)/);
    if (match && match[1]) {
      return match[1].trim();
    }
  } catch {
    // Ignore route detection failure
  }
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    if (name !== "lo" && !name.startsWith("wg") && !name.startsWith("docker")) {
      return name;
    }
  }
  return "eth0";
}

interface payload {
  signature?: string;
  data?: {
    str?: string;
  };
  publicKey?: string;
  allowedIps?: string[];
}

interface PeerRecord {
  id: string;
  publicKey: string;
  allocatedIp: string;
  status: "active" | "revoked";
  createdAt: string;
}

interface CreatePeerResponse {
  message: string;
  peer: PeerRecord;
  endpoint: string;
  serverPublicKey: string;
  allowedIps: string[];
  clientConfig: string;
  /** True when the peer is registered in the running interface, not only on disk. */
  live: boolean;
}

const api = new Hono();
const REQUEST_BODY_KEY = "validatedRequestBody";

/**
 * Peers known to this process. Seeded from wg0.conf on startup — the conf file
 * is the source of truth, this map only exists so we can serve ids.
 */
const peerStore = new Map<string, PeerRecord>();

const SERVER_CONFIG_PATH = env.wgConfigPath;
let wgServerInstance: WgConfig | null = null;
let wgServerLoadPromise: Promise<WgConfig> | null = null;

/** `10.10.1.<n>[/32]` -> n, or null when the address is outside our pool. */
function poolIndex(address: string): number | null {
  const match = address.trim().match(/^10\.10\.1\.(\d{1,3})(?:\/\d{1,2})?$/);
  if (!match) return null;
  const index = Number(match[1]);
  return index >= 1 && index <= 254 ? index : null;
}

/**
 * Every address already handed out, both from the in-memory records and from
 * the conf file. `.1` belongs to the server itself. Revoked peers release their
 * address, and the peer we are currently provisioning is excluded so
 * re-provisioning the same client keeps its address instead of burning a new
 * one on every connect.
 */
function usedPoolIndexes(excludePublicKey?: string): Set<number> {
  const used = new Set<number>([1]);
  for (const peer of peerStore.values()) {
    if (peer.status === "revoked" || peer.publicKey === excludePublicKey) continue;
    const index = poolIndex(peer.allocatedIp);
    if (index !== null) used.add(index);
  }
  for (const peer of wgServerInstance?.peers ?? []) {
    if (peer.publicKey === excludePublicKey) continue;
    for (const allowedIp of peer.allowedIps ?? []) {
      const index = poolIndex(allowedIp);
      if (index !== null) used.add(index);
    }
  }
  return used;
}

/**
 * Lowest free address of the /24. The old logic was `peerCount + 2`, which
 * handed out duplicates as soon as a peer had been revoked or a restart had
 * reshuffled the counts.
 */
function getNextAllocatedIp(excludePublicKey?: string): string {
  const used = usedPoolIndexes(excludePublicKey);
  for (let index = 2; index <= 254; index += 1) {
    if (!used.has(index)) {
      return `10.10.1.${index}`;
    }
  }
  throw new Error("VPN address pool 10.10.1.0/24 is exhausted (253 clients).");
}

/** Keep a returning client on its previous address when that address is free. */
function allocateIpFor(publicKey: string): string {
  const existing = peerStore.get(peerIdFor(publicKey));
  if (existing?.allocatedIp) {
    const index = poolIndex(existing.allocatedIp);
    if (
      index !== null &&
      index !== 1 &&
      !usedPoolIndexes(publicKey).has(index)
    ) {
      return existing.allocatedIp;
    }
  }
  return getNextAllocatedIp(publicKey);
}

/** Deterministic id, so a peer keeps the same id across restarts and deploys. */
function peerIdFor(publicKey: string): string {
  return `peer-${createHash("sha256").update(publicKey).digest("hex").slice(0, 16)}`;
}

function allocatedIpFrom(allowedIps: string[] | undefined): string {
  const ips = allowedIps ?? [];
  const poolIndexUsed = ips.map(poolIndex).find((index) => index !== null);
  if (poolIndexUsed !== null && poolIndexUsed !== undefined) {
    return `10.10.1.${poolIndexUsed}`;
  }
  return ips[0] ?? "";
}

/**
 * Rebuild the peer records from wg0.conf.
 *
 * `peerStore` used to be empty after every restart, so `GET /peers` returned
 * nothing and `DELETE /peers/:id` 404'd for every peer provisioned before the
 * restart — revoked peers were stuck in the kernel forever.
 */
function seedPeerStore(config: WgConfig): number {
  let seeded = 0;
  for (const peer of config.peers ?? []) {
    const publicKey = peer.publicKey?.trim();
    if (!publicKey) continue;
    const id = peerIdFor(publicKey);
    if (peerStore.has(id)) continue;
    peerStore.set(id, {
      id,
      publicKey,
      allocatedIp: allocatedIpFrom(peer.allowedIps),
      status: "active",
      createdAt: new Date().toISOString(),
    });
    seeded += 1;
  }
  return seeded;
}

/** Peers as declared by the config file (the desired state of the kernel). */
function configPeers(config: WgConfig): DesiredPeer[] {
  return (config.peers ?? []).filter((peer) => Boolean(peer.publicKey));
}

/**
 * The interface can only serve the key pair written in the conf. They diverge
 * when the config file was replaced (the old deploy shipped a fresh keypair on
 * every release) while the interface kept running with the previous one.
 */
function isKeyMismatch(state: InterfaceState, config: WgConfig): boolean {
  return Boolean(
    state.exists &&
      state.publicKey &&
      config.publicKey &&
      state.publicKey !== config.publicKey,
  );
}

async function generateWireGuardKeyPair(): Promise<{
  publicKey: string;
  privateKey: string;
}> {
  const { publicKey, privateKey } = (await crypto.subtle.generateKey(
    { name: "X25519" },
    true,
    ["deriveBits"],
  )) as CryptoKeyPair;

  const publicKeyJWK = await crypto.subtle.exportKey("jwk", publicKey);
  const privateKeyJWK = await crypto.subtle.exportKey("jwk", privateKey);

  if (!publicKeyJWK.x || !privateKeyJWK.d) {
    throw new Error("Failed to export keys");
  }

  return {
    publicKey: Buffer.from(publicKeyJWK.x, "base64url").toString("base64"),
    privateKey: Buffer.from(privateKeyJWK.d, "base64url").toString("base64"),
  };
}

/**
 * Creates/initializes the server wg0 WireGuard tunnel configuration file with IPTables NAT rules
 */
async function loadWgServerTunnel(configPath: string): Promise<WgConfig> {
  const dirPath = path.dirname(configPath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  const wanIf = getDefaultWanInterface();

  const wgConfig = new WgConfig({
    filePath: configPath,
    wgInterface: {
      address: ["10.10.1.1/24"],
      listenPort: 51820,
      postUp: [
        // Clients are NAT'd out of this host. Without forwarding the tunnel
        // handshakes fine and carries no traffic: Docker sets the sysctl via
        // `sysctls`, the EC2 systemd unit does not. Left enabled on down so we
        // never toggle a setting other services may rely on.
        `sysctl -w net.ipv4.ip_forward=1`,
        `iptables -A FORWARD -i %i -j ACCEPT`,
        `iptables -A FORWARD -o %i -j ACCEPT`,
        `iptables -t nat -A POSTROUTING -o ${wanIf} -j MASQUERADE`,
      ],
      postDown: [
        `iptables -D FORWARD -i %i -j ACCEPT`,
        `iptables -D FORWARD -o %i -j ACCEPT`,
        `iptables -t nat -D POSTROUTING -o ${wanIf} -j MASQUERADE`,
      ],
    },
  });

  if (fs.existsSync(configPath)) {
    await wgConfig.parseFile(configPath);
    await wgConfig.generateKeys();
    const seeded = seedPeerStore(wgConfig);
    if (seeded > 0) {
      console.log(`[wireguard] restored ${seeded} peer(s) from ${configPath}`);
    }
  } else {
    try {
      await wgConfig.generateKeys();
    } catch {
      const keys = await generateWireGuardKeyPair();
      wgConfig.wgInterface.privateKey = keys.privateKey;
      wgConfig.publicKey = keys.publicKey;
    }
    await wgConfig.writeToFile(configPath);
  }

  return wgConfig;
}

/**
 * Loads the server WireGuard configuration once and reuses it for later requests.
 */
export async function initWgServerTunnel(
  configPath: string = SERVER_CONFIG_PATH,
): Promise<WgConfig> {
  if (wgServerInstance) {
    return wgServerInstance;
  }

  if (!wgServerLoadPromise) {
    wgServerLoadPromise = loadWgServerTunnel(configPath)
      .then((wgConfig) => {
        wgServerInstance = wgConfig;
        return wgConfig;
      })
      .finally(() => {
        wgServerLoadPromise = null;
      });
  }

  return wgServerLoadPromise;
}

/**
 * Adds a peer to the wg0 config file **and** to the running interface.
 *
 * The write to wg0.conf is what survives restarts and deploys; the `wg set` is
 * what makes the peer usable *right now* without bouncing the tunnel (the
 * wireguard-tools library has no such operation — see wg/runtime.ts).
 *
 * Returns whether the peer is live in the kernel, so callers can tell the
 * difference between "registered" and "registered on disk only".
 */
export async function addPeerToWgServer(
  publicKey: string,
  allowedIps: string[],
  configPath: string = SERVER_CONFIG_PATH,
): Promise<{ config: WgConfig; live: boolean }> {
  const wgConfig = wgServerInstance || (await initWgServerTunnel(configPath));
  wgConfig.addPeer({
    publicKey,
    allowedIps,
  });
  await wgConfig.writeToFile();
  const change = await registerPeerLive(publicKey, allowedIps);
  return { config: wgConfig, live: change === "changed" };
}

/** Hot-register a peer. Throws when `wg set` fails so callers can report it. */
async function registerPeerLive(
  publicKey: string,
  allowedIps: string[],
): Promise<"changed" | "interface-down"> {
  if (!(await interfaceExists(env.wgInterface))) {
    console.warn(
      `[wireguard] ${env.wgInterface} is down — peer ${publicKey} was persisted to ` +
        `${SERVER_CONFIG_PATH} and will be registered when the interface comes up.`,
    );
    return "interface-down";
  }
  await setPeer(env.wgInterface, publicKey, allowedIps);
  return "changed";
}

/** Hot-revoke a peer. Throws when `wg set` fails so callers can report it. */
async function unregisterPeerLive(
  publicKey: string,
): Promise<"changed" | "interface-down"> {
  if (!(await interfaceExists(env.wgInterface))) {
    return "interface-down";
  }
  await removePeer(env.wgInterface, publicKey);
  return "changed";
}

function normalizePublicKey(
  publicKey: string | undefined,
  fallback: string | undefined,
): string {
  return (publicKey?.trim() || fallback?.trim() || "").trim();
}

export async function createPeerRecord(
  body: payload,
): Promise<CreatePeerResponse> {
  const publicKey = normalizePublicKey(body.publicKey, body.data?.str);
  if (!publicKey) {
    throw new Error("publicKey is required");
  }

  const allocatedIp = allocateIpFor(publicKey);
  const allowedIps =
    body.allowedIps && body.allowedIps.length > 0
      ? body.allowedIps
      : [`${allocatedIp}/32`];

  const peer: PeerRecord = {
    id: peerIdFor(publicKey),
    publicKey,
    allocatedIp,
    status: "active",
    createdAt: new Date().toISOString(),
  };

  peerStore.set(peer.id, peer);

  await initWgServerTunnel();
  const { config: wgConfig, live } = await addPeerToWgServer(
    publicKey,
    allowedIps,
  );
  const serverPublicKey = wgConfig.publicKey || env.wgServerPublicKey;

  if (!serverPublicKey) {
    throw new Error("WireGuard server public key is not configured");
  }
  const { endpoint } = await resolveEndpoint();

  // No `DNS =` line: the exit node runs no resolver, so pointing clients at
  // 10.10.1.x only breaks name resolution ("nothing loads"). The client keeps
  // its own resolver and those queries are covered by AllowedIPs 0.0.0.0/0,
  // so they ride the tunnel and get NAT'd out like any other traffic.
  const clientConfig = `[Interface]
PrivateKey = <CLIENT_PRIVATE_KEY>
Address = ${allocatedIp}/32

[Peer]
PublicKey = ${serverPublicKey}
Endpoint = ${endpoint}
AllowedIPs = 0.0.0.0/0, ::/0
`;

  return {
    message: live
      ? "peer created successfully and registered on the live interface"
      : "peer created successfully (config persisted; interface is not up yet)",
    peer,
    endpoint,
    serverPublicKey,
    allowedIps,
    clientConfig,
    live,
  };
}

const ControlPanelAuthMiddleware = createMiddleware(
  async (c: Context, next: Next) => {
    if (c.req.method === "GET") {
      // NOTE: GET routes are unauthenticated by design today — the desktop and
      // mobile clients call them without BACKEND_API_SECRET. Require the
      // signature (or real user auth) here before exposing /api publicly;
      // HTTPS (Caddy) encrypts the transport but does not authenticate reads.
      return await next();
    }

    const secret = env.backendApiSecret;

    let body: payload;
    try {
      body = await c.req.json<payload>();
    } catch {
      return c.json({ message: "invalid JSON request body" }, 400);
    }

    if (
      typeof body.signature !== "string" ||
      typeof body.data?.str !== "string"
    ) {
      return c.json({ message: "signature and signed data are required" }, 401);
    }

    try {
      const isValid = await verifySignature(
        secret,
        body.data.str,
        body.signature,
      );
      if (!isValid) {
        return c.json({ message: "invalid request signature" }, 401);
      }
    } catch {
      return c.json({ message: "invalid request signature" }, 401);
    }

    c.set(REQUEST_BODY_KEY, body);
    await next();
  },
);

const createPeer: Handler = async (c) => {
  const body = c.get(REQUEST_BODY_KEY) as payload | undefined;
  if (!body) {
    return c.json({ message: "request body missing" }, 400);
  }

  try {
    const response = await createPeerRecord(body);
    return c.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unable to create peer";
    // A `wg set` failure means the peer is on disk but not usable yet — that is
    // a server-side problem, not a bad request.
    return c.json({ message }, error instanceof WgCommandError ? 500 : 400);
  }
};

const toggleTunnelUp: Handler = async (c) => {
  try {
    const wgConfig = await initWgServerTunnel();

    // Plain `wg-quick` is correct everywhere: the systemd unit runs as root and
    // the container has NET_ADMIN, so there is no sudo variant to choose
    // between. Errors are surfaced instead of being swallowed — the old
    // handler reported "active" even when wg-quick had just failed.
    const result = await bringUp(SERVER_CONFIG_PATH, env.wgInterface);

    const forward = enableIpForward();
    if (!forward.enabled) {
      console.warn(
        `[wireguard] net.ipv4.ip_forward could not be enabled: ${forward.error ?? "unknown"}`,
      );
    }

    // `wg-quick up` already loaded every peer from the conf; this only repairs
    // drift when the interface was already running (brought up outside the API,
    // conf edited by hand, a previous deploy left stale peers behind...).
    const sync = await reconcilePeers(env.wgInterface, configPeers(wgConfig));

    return c.json({
      message:
        result === "created"
          ? `Exit Node ${env.wgInterface} interface brought UP successfully`
          : `Exit Node ${env.wgInterface} was already UP — peers reconciled`,
      status: "active",
      interface: env.wgInterface,
      ipForward: forward.enabled,
      peers: sync,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[wireguard] bringing ${env.wgInterface} up failed:`, message);
    const state = await readInterface(env.wgInterface);
    return c.json(
      {
        message: `Failed to bring up ${env.wgInterface}: ${message}`,
        status: state.exists ? "active" : "inactive",
        interface: env.wgInterface,
      },
      500,
    );
  }
};

const toggleTunnelDown: Handler = async (c) => {
  try {
    const result = await bringDown(SERVER_CONFIG_PATH, env.wgInterface);
    return c.json({
      message:
        result === "removed"
          ? `Exit Node ${env.wgInterface} interface brought DOWN successfully`
          : `Exit Node ${env.wgInterface} was already DOWN`,
      status: "inactive",
      interface: env.wgInterface,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[wireguard] bringing ${env.wgInterface} down failed:`, message);
    const state = await readInterface(env.wgInterface);
    return c.json(
      {
        message: `Failed to bring down ${env.wgInterface}: ${message}`,
        status: state.exists ? "active" : "inactive",
        interface: env.wgInterface,
      },
      500,
    );
  }
};

/**
 * Status measured from the kernel — the previous implementation reported a
 * module-level variable that survived process restarts and lied after failures.
 */
const getTunnelStatus: Handler = async (c) => {
  const state = await readInterface(env.wgInterface);
  const endpoint = await resolveEndpoint();
  const wgConfig = wgServerInstance ?? (await initWgServerTunnel());
  const configuredPeers = configPeers(wgConfig);
  const keyMismatch = isKeyMismatch(state, wgConfig);

  return c.json({
    status: state.exists ? "active" : "inactive",
    // Peers actually usable right now (kernel), not "peers we know about".
    activePeers: state.peers.length,
    configuredPeers: configuredPeers.length,
    trackedPeers: peerStore.size,
    livePeers: state.peers,
    interface: env.wgInterface,
    interfaceAvailable: state.available,
    keyMismatch,
    ipForward: readIpForward(),
    autoUp: env.wgAutoUp,
    serverConfigPath: SERVER_CONFIG_PATH,
    endpoint: endpoint.endpoint,
    endpointSource: endpoint.source,
    endpointWarning: endpoint.warning,
    wanInterface: getDefaultWanInterface(),
    ...(state.error ? { error: state.error } : {}),
  });
};

const listPeers: Handler = (c) => {
  return c.json({ peers: Array.from(peerStore.values()) });
};

const getPeer: Handler = (c) => {
  const peerId = c.req.param("peerId");
  if (!peerId) {
    return c.json({ message: "peer id is required" }, 400);
  }

  const peer = peerStore.get(peerId);
  if (!peer) {
    return c.json({ message: "peer not found" }, 404);
  }

  return c.json({ peer });
};

const revokePeer: Handler = async (c) => {
  const peerId = c.req.param("peerId");
  if (!peerId) {
    return c.json({ message: "peer id is required" }, 400);
  }

  const peer = peerStore.get(peerId);
  if (!peer) {
    return c.json({ message: "peer not found" }, 404);
  }

  if (peer.status === "revoked") {
    return c.json({ message: "peer already revoked", peer });
  }

  // Remove it from the config first (that is what a restart will honour), then
  // from the running interface so it stops working immediately.
  try {
    const wgConfig = wgServerInstance || (await initWgServerTunnel());
    wgConfig.removePeer(peer.publicKey);
    await wgConfig.writeToFile();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unable to revoke peer";
    return c.json({ message }, 500);
  }

  let live: "changed" | "interface-down";
  try {
    live = await unregisterPeerLive(peer.publicKey);
  } catch (error) {
    // The conf no longer has the peer but the kernel still does: keep the
    // record active so a retry removes it from the interface too.
    const message = error instanceof Error ? error.message : String(error);
    return c.json(
      {
        message:
          `Peer was revoked in ${SERVER_CONFIG_PATH} but could not be removed from the ` +
          `running interface (${message}) — retry, or restart the tunnel.`,
        peer,
        live: false,
      },
      500,
    );
  }

  peer.status = "revoked";
  peerStore.set(peer.id, peer);
  return c.json({
    message:
      live === "changed"
        ? "peer revoked (removed from the running interface and the config)"
        : "peer revoked in config (interface was down)",
    peer,
    live: live === "changed",
  });
};

api.use("*", ControlPanelAuthMiddleware);

api.post("/peers", createPeer);
api.post("/tunnel/up", toggleTunnelUp);
api.post("/tunnel/down", toggleTunnelDown);
api.get("/tunnel/status", getTunnelStatus);
api.get("/peers", listPeers);
api.get("/peers/:peerId", getPeer);
api.delete("/peers/:peerId", revokePeer);

/**
 * Restore the data plane after a boot, a deploy or a crash.
 *
 * Until now nothing brought wg0 up on its own (only the control-panel button),
 * and a peer only ever reached the kernel if `wg-quick up` happened *after* it
 * had been written to the conf. This runs once at startup, is idempotent and
 * never throws — a failure leaves the API up so `/health` and the status
 * endpoint can explain what is wrong.
 */
export async function bootstrapTunnel(): Promise<void> {
  const forward = enableIpForward();
  if (forward.enabled) {
    console.log("[wireguard] net.ipv4.ip_forward=1");
  } else {
    console.warn(
      `[wireguard] net.ipv4.ip_forward is NOT enabled: ${forward.error ?? "unknown"} — ` +
        `client traffic will be forwarded nowhere.`,
    );
  }

  const endpoint = await resolveEndpoint();
  if (endpoint.warning) {
    console.warn(`[wireguard] ${endpoint.warning}`);
  } else {
    console.log(
      `[wireguard] client endpoint: ${endpoint.endpoint} (source: ${endpoint.source})`,
    );
  }

  let wgConfig: WgConfig;
  try {
    wgConfig = await initWgServerTunnel();
  } catch (error) {
    console.error(
      `[wireguard] could not load ${SERVER_CONFIG_PATH}:`,
      error instanceof Error ? error.message : error,
    );
    return;
  }

  if (env.wgAutoUp) {
    try {
      const result = await bringUp(SERVER_CONFIG_PATH, env.wgInterface);
      console.log(
        `[wireguard] ${env.wgInterface} ${result === "created" ? "brought up" : "is already up"}`,
      );
    } catch (error) {
      console.error(
        `[wireguard] wg-quick up failed:`,
        error instanceof Error ? error.message : error,
      );
    }
  } else {
    console.log(
      `[wireguard] WG_AUTO_UP is disabled — leaving ${env.wgInterface} as it is`,
    );
  }

  try {
    const state = await readInterface(env.wgInterface);
    if (!state.available) {
      console.error(
        `[wireguard] wireguard-tools is not usable: ${state.error ?? "unknown error"}`,
      );
      return;
    }
    if (!state.exists) {
      console.warn(
        `[wireguard] ${env.wgInterface} is down; ${configPeers(wgConfig).length} peer(s) ` +
          `wait in ${SERVER_CONFIG_PATH} for the next \`wg-quick up\`.`,
      );
      return;
    }
    if (isKeyMismatch(state, wgConfig)) {
      console.error(
        `[wireguard] ${env.wgInterface} is running with public key ${state.publicKey} but ` +
          `${SERVER_CONFIG_PATH} holds ${wgConfig.publicKey} — clients provisioned with the ` +
          `config key cannot connect. Bring the tunnel down and up to re-key.`,
      );
    }

    const sync = await reconcilePeers(env.wgInterface, configPeers(wgConfig));
    console.log(
      `[wireguard] reconciled ${SERVER_CONFIG_PATH}: +${sync.added} added, ` +
        `~${sync.updated} updated, -${sync.removed} removed, ${sync.unchanged} unchanged`,
    );
  } catch (error) {
    console.error(
      "[wireguard] peer reconciliation failed:",
      error instanceof Error ? error.message : error,
    );
  }
}

export default api;
