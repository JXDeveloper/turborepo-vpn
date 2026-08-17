import { auth } from "@clerk/nextjs/server";
import { generateSignature } from "@my-vpn/crypto-utils";

const apiBaseUrl = (
  process.env.VPN_API_URL || "http://127.0.0.1:3001/api"
).replace(/\/$/, "");

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    cache: "no-store",
  });
  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(
      result?.message || `VPN API request failed (${response.status})`,
    );
  }
  return response.json() as Promise<T>;
}

export async function signedApiRequest<T>(
  path: string,
  method: "POST" | "DELETE",
  payload: Record<string, unknown> = {},
): Promise<T> {
  await auth.protect();
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
