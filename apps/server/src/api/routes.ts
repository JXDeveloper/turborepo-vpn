import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { verifySignature } from "@my-vpn/crypto-utils";
import { Hono, type Handler } from "hono";
import { createMiddleware } from "hono/factory";
import { WgConfig } from "wireguard-tools";

function getEndpointAddress(): string {
  if (process.env.WG_ENDPOINT) {
    return process.env.WG_ENDPOINT;
  }
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (!iface.internal && iface.family === "IPv4" && !iface.address.startsWith("172.17.")) {
        return `${iface.address}:51820`;
      }
    }
  }
  return "127.0.0.1:51820";
}

function getDefaultWanInterface(): string {
  if (process.env.WG_WAN_INTERFACE) {
    return process.env.WG_WAN_INTERFACE;
  }
  try {
    const routeOutput = execSync("ip route show default", { encoding: "utf-8" });
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
  status: "active";
  createdAt: string;
}

interface CreatePeerResponse {
  message: string;
  peer: PeerRecord;
  endpoint: string;
  serverPublicKey: string;
  allowedIps: string[];
  clientConfig: string;
}

const api = new Hono();
const REQUEST_BODY_KEY = "validatedRequestBody";

const peerStore = new Map<string, PeerRecord>();
let nextIpIndex = 2;
let tunnelState: "active" | "inactive" = "inactive";

const SERVER_CONFIG_DIR = path.join(process.cwd(), "configs");
const SERVER_CONFIG_PATH = path.join(SERVER_CONFIG_DIR, "wg0.conf");
let wgServerInstance: WgConfig | null = null;

async function generateWireGuardKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
  const { publicKey, privateKey } = (await crypto.subtle.generateKey({ name: "X25519" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;

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
export async function initWgServerTunnel(configPath: string = SERVER_CONFIG_PATH): Promise<WgConfig> {
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

  wgServerInstance = wgConfig;
  return wgConfig;
}

/**
 * Adds a peer to the existing wg0 server WireGuard tunnel
 */
export async function addPeerToWgServer(
  publicKey: string,
  allowedIps: string[],
  configPath: string = SERVER_CONFIG_PATH,
): Promise<WgConfig> {
  const wgConfig = wgServerInstance || (await initWgServerTunnel(configPath));
  wgConfig.addPeer({
    publicKey,
    allowedIps,
  });
  await wgConfig.writeToFile();
  return wgConfig;
}

function getNextAllocatedIp(): string {
  const ip = `10.10.1.${nextIpIndex}`;
  nextIpIndex += 1;
  return ip;
}

function normalizePublicKey(publicKey: string | undefined, fallback: string | undefined): string {
  return (publicKey?.trim() || fallback?.trim() || "").trim();
}

export async function createPeerRecord(body: payload): Promise<CreatePeerResponse> {
  const publicKey = normalizePublicKey(body.publicKey, body.data?.str);
  if (!publicKey) {
    throw new Error("publicKey is required");
  }

  const allocatedIp = getNextAllocatedIp();
  const allowedIps = body.allowedIps && body.allowedIps.length > 0 ? body.allowedIps : [`${allocatedIp}/32`];

  const peer: PeerRecord = {
    id: `peer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    publicKey,
    allocatedIp,
    status: "active",
    createdAt: new Date().toISOString(),
  };

  peerStore.set(peer.id, peer);

  const wgConfig = await initWgServerTunnel();
  await addPeerToWgServer(publicKey, allowedIps);

  const serverPublicKey =
    wgConfig.publicKey || wgConfig.wgInterface?.privateKey || process.env.WG_SERVER_PUBLIC_KEY || "server-public-key";
  const endpoint = getEndpointAddress();

  const clientConfig = `[Interface]
PrivateKey = <CLIENT_PRIVATE_KEY>
Address = ${allocatedIp}/32
DNS = 10.10.1.1

[Peer]
PublicKey = ${serverPublicKey}
Endpoint = ${endpoint}
AllowedIPs = 0.0.0.0/0, ::/0
`;

  return {
    message: "peer created successfully",
    peer,
    endpoint,
    serverPublicKey,
    allowedIps,
    clientConfig,
  };
}

const ControlPanelAuthMiddleware = createMiddleware(async (c, next) => {
  if (c.req.method === "GET") {
    return await next();
  }

  const secret = process.env.BACKEND_API_SECRET;
  if (!secret) {
    return c.json({ message: "authentication is not configured" }, 500);
  }

  let body: payload;
  try {
    body = await c.req.json<payload>();
  } catch {
    return c.json({ message: "invalid JSON request body" }, 400);
  }

  if (typeof body.signature !== "string" || typeof body.data?.str !== "string") {
    return c.json({ message: "signature and signed data are required" }, 401);
  }

  try {
    const isValid = await verifySignature(secret, body.data.str, body.signature);
    if (!isValid) {
      return c.json({ message: "invalid request signature" }, 401);
    }
  } catch {
    return c.json({ message: "invalid request signature" }, 401);
  }

  c.set(REQUEST_BODY_KEY, body);
  await next();
});

const createPeer: Handler = async (c) => {
  const body = c.get(REQUEST_BODY_KEY) as payload | undefined;
  if (!body) {
    return c.json({ message: "request body missing" }, 400);
  }

  try {
    const response = await createPeerRecord(body);
    return c.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unable to create peer";
    return c.json({ message }, 400);
  }
};

const toggleTunnelUp: Handler = async (c) => {
  const wgConfig = await initWgServerTunnel();
  try {
    await wgConfig.up();
    tunnelState = "active";
    return c.json({ message: "Exit Node wg0 interface brought UP successfully", status: "active" });
  } catch (error) {
    tunnelState = "active";
    const message = error instanceof Error ? error.message : "Tunnel UP signal sent";
    return c.json({ message: `Exit Node wg0 configured. (${message})`, status: "active" });
  }
};

const toggleTunnelDown: Handler = async (c) => {
  const wgConfig = await initWgServerTunnel();
  try {
    await wgConfig.down();
    tunnelState = "inactive";
    return c.json({ message: "Exit Node wg0 interface brought DOWN successfully", status: "inactive" });
  } catch (error) {
    tunnelState = "inactive";
    const message = error instanceof Error ? error.message : "Tunnel DOWN signal sent";
    return c.json({ message: `Exit Node wg0 set to DOWN. (${message})`, status: "inactive" });
  }
};

const getTunnelStatus: Handler = async (c) => {
  return c.json({
    status: tunnelState,
    activePeers: peerStore.size,
    serverConfigPath: SERVER_CONFIG_PATH,
    endpoint: getEndpointAddress(),
    wanInterface: getDefaultWanInterface(),
  });
};

const revokePeer: Handler = (c) => {
  const secret = process.env.BACKEND_API_SECRET;
  if (!secret) {
    throw new Error("unable to load env deletePeer");
  }

  return c.json({ message: "all good delete peer" });
};

api.use("*", ControlPanelAuthMiddleware);

api.post("/peers", createPeer);
api.post("/tunnel/up", toggleTunnelUp);
api.post("/tunnel/down", toggleTunnelDown);
api.get("/tunnel/status", getTunnelStatus);
api.delete("", revokePeer);

export default api;
