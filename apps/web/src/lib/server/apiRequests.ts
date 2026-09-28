import { auth } from "@clerk/nextjs/server";
import { generateSignature } from "@my-vpn/crypto-utils";
import { getBackendApiSecret, getVpnApiUrl } from "@/lib/server/env";

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${getVpnApiUrl()}${path}`, {
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
  const secret = getBackendApiSecret();
  const signedData = JSON.stringify(payload);
  const signature = await generateSignature(secret, signedData);
  return apiRequest<T>(path, {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ ...payload, signature, data: { str: signedData } }),
  });
}
