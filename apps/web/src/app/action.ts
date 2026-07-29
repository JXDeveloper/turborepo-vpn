"use server";

import crypto from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { generateSignature } from "@my-vpn/crypto-utils";
import { exitNodes } from "@/db/schema";
import { db } from "@/db/db";

export interface Peer {
  id: string;
  publicKey: string;
  allocatedIp: string;
  status: "active" | "revoked";
  createdAt: string;
}

export interface TunnelStatus {
  status: "active" | "inactive";
  activePeers: number;
  endpoint: string;
  wanInterface: string;
  serverConfigPath: string;
}

export interface CreatedPeer {
  peer: Peer;
  endpoint: string;
  clientConfig: string;
}

const apiBaseUrl = (process.env.VPN_API_URL || "http://127.0.0.1:3001/api").replace(/\/$/, "");

async function requireAdmin() {
  await auth.protect();
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, cache: "no-store" });
  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(result?.message || `VPN API request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

async function signedApiRequest<T>(
  path: string,
  method: "POST" | "DELETE",
  payload: Record<string, unknown> = {},
): Promise<T> {
  await requireAdmin();
  const secret = process.env.BACKEND_API_SECRET;
  if (!secret) {
    throw new Error("BACKEND_API_SECRET is not configured");
  }

  const signedData = JSON.stringify(payload);
  const signature = await generateSignature(secret, signedData);
  return apiRequest<T>(path, {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ ...payload, signature, data: { str: signedData } }),
  });
}

function generateClientKeyPair(): { publicKey: string; privateKey: string } {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("x25519");
  return {
    publicKey: publicKey.export({ type: "spki", format: "der" }).subarray(-32).toString("base64"),
    privateKey: privateKey.export({ type: "pkcs8", format: "der" }).subarray(-32).toString("base64"),
  };
}

export async function getTunnelStatus(): Promise<TunnelStatus> {
  await requireAdmin();
  return apiRequest<TunnelStatus>("/tunnel/status");
}

export async function getPeers(): Promise<Peer[]> {
  await requireAdmin();
  const result = await apiRequest<{ peers: Peer[] }>("/peers");
  return result.peers;
}

export async function getPeer(peerId: string): Promise<Peer> {
  await requireAdmin();
  const result = await apiRequest<{ peer: Peer }>(`/peers/${encodeURIComponent(peerId)}`);
  return result.peer;
}

export async function createPeer(): Promise<CreatedPeer> {
  const clientKeys = generateClientKeyPair();
  const result = await signedApiRequest<CreatedPeer & { clientConfig: string }>("/peers", "POST", {
    publicKey: clientKeys.publicKey,
    allowedIps: [],
  });

  return {
    ...result,
    clientConfig: result.clientConfig.replace("<CLIENT_PRIVATE_KEY>", clientKeys.privateKey),
  };
}

export async function setTunnelState(state: "up" | "down"): Promise<{ message: string; status: string }> {
  return signedApiRequest(`/tunnel/${state}`, "POST");
}

export async function revokePeer(peerId: string): Promise<Peer> {
  const result = await signedApiRequest<{ peer: Peer }>(`/peers/${encodeURIComponent(peerId)}`, "DELETE", { peerId });
  return result.peer;
}

interface ExitNode {
  id: string;
  publicKey: string;
  publicIp: string;
  portNo: number;
}

export async function getExitNodes(): Promise<ExitNode> {
  const exitNode = await db.select().from(exitNodes);
  const data: ExitNode = {
    id: exitNode[0].id,
    publicKey: exitNode[0].publicKey,
    publicIp: exitNode[0].publicIp,
    portNo: exitNode[0].portNo,
  };
  return data;
}
