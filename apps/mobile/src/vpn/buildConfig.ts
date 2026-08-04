// apps/mobile/src/vpn/buildConfig.ts
interface VpnServerConfig {
  serverPublicKey: string;
  endpoint: string; // "vpn.yourbackend.com:51820"
  assignedClientIp: string; // "10.0.0.2"
  dns?: string;
}

export function buildWireguardConfig(
  clientPrivateKey: string,
  server: VpnServerConfig,
): string {
  return `
[Interface]
PrivateKey = ${clientPrivateKey}
Address = ${server.assignedClientIp}/32
DNS = ${server.dns ?? "1.1.1.1"}

[Peer]
PublicKey = ${server.serverPublicKey}
Endpoint = ${server.endpoint}
AllowedIPs = 0.0.0.0/0
`.trim();
}
