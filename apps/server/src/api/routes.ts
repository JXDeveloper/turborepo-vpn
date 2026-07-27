import { verifySignature } from "@my-vpn/crypto-utils";
import { Hono, type Handler } from "hono";
import { createMiddleware } from "hono/factory";

interface payload {
  signature: string;
  data?: {
    str?: string;
  };
  publicKey?: string;
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
}

const api = new Hono();
const REQUEST_BODY_KEY = "validatedRequestBody";

const peerStore = new Map<string, PeerRecord>();
let nextIpIndex = 2;

function getNextAllocatedIp(): string {
  const ip = `10.10.1.${nextIpIndex}`;
  nextIpIndex += 1;
  return ip;
}

function normalizePublicKey(publicKey: string | undefined, fallback: string | undefined): string {
  return (publicKey?.trim() || fallback?.trim() || "").trim();
}

export function createPeerRecord(body: payload): CreatePeerResponse {
  const publicKey = normalizePublicKey(body.publicKey, body.data?.str);
  if (!publicKey) {
    throw new Error("publicKey is required");
  }

  const peer: PeerRecord = {
    id: `peer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    publicKey,
    allocatedIp: getNextAllocatedIp(),
    status: "active",
    createdAt: new Date().toISOString(),
  };

  peerStore.set(peer.id, peer);

  return {
    message: "peer created successfully",
    peer,
    endpoint: process.env.WG_ENDPOINT ?? "127.0.0.1:51820",
    serverPublicKey: process.env.WG_SERVER_PUBLIC_KEY ?? "server-public-key",
    allowedIps: [`${peer.allocatedIp}/32`],
  };
}

const ControlPanelAuthMiddleware = createMiddleware(async (c, next) => {
  const secret = process.env.BACKEND_API_SECRET;
  if (!secret) {
    throw new Error("unable to load env createPeer");
  }

  const body = await c.req.json<payload>();
  if (!(await verifySignature(secret, `${body.data?.str ?? ""}1`, body.signature))) {
    return c.json({ message: "u are not authored to request this endpoint" }, 403);
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
    const response = createPeerRecord(body);
    return c.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unable to create peer";
    return c.json({ message }, 400);
  }
};

const revokePeer: Handler = (c) => {
  const secret = process.env.BACKEND_API_SECRET;
  if (!secret) {
    throw new Error("unable to load env deletePeer");
  }

  return c.json({ message: "all good delete peer" });
};

api.use("*", ControlPanelAuthMiddleware);

api.post("", createPeer);
api.post("/peers", createPeer);
api.delete("", revokePeer);

export default api;
