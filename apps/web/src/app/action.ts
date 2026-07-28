"use server";

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { generateSignature } from "@my-vpn/crypto-utils";

function generateClientKeyPair(): { publicKey: string; privateKey: string } {
  try {
    const { privateKey, publicKey } = crypto.generateKeyPairSync("x25519");
    const pubRaw = publicKey.export({ type: "spki", format: "der" }).subarray(-32);
    const privRaw = privateKey.export({ type: "pkcs8", format: "der" }).subarray(-32);
    return {
      publicKey: pubRaw.toString("base64"),
      privateKey: privRaw.toString("base64"),
    };
  } catch {
    const priv = crypto.randomBytes(32);
    const pub = crypto.randomBytes(32);
    return {
      publicKey: pub.toString("base64"),
      privateKey: priv.toString("base64"),
    };
  }
}

export default async function makeReq(): Promise<any> {
  const secret = process.env.BACKEND_API_SECRET;
  if (!secret) {
    throw new Error(`cannot load env variable`);
  }

  try {
    const clientKeys = generateClientKeyPair();
    const str = "hello world";
    const signature = await generateSignature(secret, str);

    const res = await fetch("http://localhost:3000/api/peers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        signature,
        publicKey: clientKeys.publicKey,
        allowedIps: [],
        data: {
          str,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.log(`Response error: ${res.status}`, errText);
      throw new Error(`res was not good ${res.status}`);
    }

    const data = await res.json();

    const targetDir = path.join(process.cwd(), "config");
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const finalClientConfig = data.clientConfig
      ? data.clientConfig.replace("<CLIENT_PRIVATE_KEY>", clientKeys.privateKey)
      : "";

    const peerFilePath = path.join(targetDir, `${data.peer?.id || "wg0-client"}.conf`);
    const defaultFilePath = path.join(targetDir, "wg0-client.conf");

    fs.writeFileSync(peerFilePath, finalClientConfig, "utf-8");
    fs.writeFileSync(defaultFilePath, finalClientConfig, "utf-8");

    return {
      success: true,
      peer: data.peer,
      endpoint: data.endpoint,
      configPath: peerFilePath,
      config: finalClientConfig,
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.log(error.message);
    }
    throw error;
  }
}

export async function toggleTunnelUpAction(): Promise<any> {
  const res = await fetch("http://localhost:3000/api/tunnel/up", { method: "POST" });
  return await res.json();
}

export async function toggleTunnelDownAction(): Promise<any> {
  const res = await fetch("http://localhost:3000/api/tunnel/down", { method: "POST" });
  return await res.json();
}

export async function getTunnelStatusAction(): Promise<any> {
  const res = await fetch("http://localhost:3000/api/tunnel/status", { method: "GET" });
  return await res.json();
}
