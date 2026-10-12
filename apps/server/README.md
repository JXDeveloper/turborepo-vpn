# `server` — exit node

Hono HTTP API that manages the WireGuard exit node: creates/revokes peers,
toggles the tunnel, and reports status. Deployed to EC2 by
`.github/workflows/deploy-exit-node_ec2.yml`, runs under
`deployment/vpn-exit-node.service`.

## Configuration

No endpoints or secrets are hardcoded. See [`.env.example`](./.env.example)
for all keys.

| Variable | Required | Notes |
| --- | --- | --- |
| `BACKEND_API_SECRET` | ✅ | HMAC secret shared with `apps/web` — server refuses to start without it |
| `PORT` | no | defaults to `3001` |
| `WG_ENDPOINT` | ✅ on EC2 | public `ip:51820` for client configs. Auto-detection tries EC2 IMDS first, then a public interface address; without it clients get an unreachable private VPC IP and cannot connect |
| `WG_WAN_INTERFACE` | no | NAT masquerade interface (auto-detected) |
| `WG_SERVER_PUBLIC_KEY` | no | fallback key; `wg0.conf` takes precedence |
| `WG_CONFIG_PATH` | no | config the server manages (default `./configs/wg0.conf`). **Production must point it outside `/opt/releases/<sha>`** — see below |
| `WG_AUTO_UP` | no | bring the interface up at boot and reconcile peers. Defaults to `true` when `NODE_ENV=production`, `false` otherwise |

- **Local dev:** `cp .env.example .env` and fill it in (loaded automatically by `pnpm dev`).
- **Production:** CI writes `/etc/metro-vpn/exit-node.env` on the host; the
  systemd unit loads it via `EnvironmentFile`.

### Config lives outside the release directory

`pnpm deploy` ships only `dist/**` + `package.json` + the unit file, and every
release lands in `/opt/releases/<sha>` behind a `current` symlink. A config
inside the release directory therefore means a **fresh server keypair and zero
peers on every deploy** (clients provisioned earlier stop connecting). CI keeps
it at `/var/lib/metro-vpn/configs/wg0.conf`, migrating any older file on first
run.

## WireGuard lifecycle

`wg0.conf` is the *desired* state, the kernel interface is the *live* state,
and the server keeps them in sync — the wireguard-tools library we use can only
edit the file, so `wg/runtime.ts` drives `wg set` / `wg-quick` directly:

- **`POST /api/peers`** — writes the peer to `wg0.conf` *and* hot-registers it
  with `wg set wg0 peer <key> allowed-ips …`. No tunnel restart: it works right
  away, and if the interface is down the peer is simply picked up by the next
  `wg-quick up`. The response carries `live: true|false`.
- **`DELETE /api/peers/:id`** — removes it from the conf *and* from the running
  interface, so the peer stops working immediately.
- **`POST /api/tunnel/up`** — `wg-quick up`, enables `net.ipv4.ip_forward`,
  then reconciles conf vs kernel. Real failures now return **500** with the
  actual `wg-quick` stderr (they used to report `active` no matter what).
- **Boot** (`bootstrapTunnel`) — enables forwarding, brings the interface up
  when `WG_AUTO_UP` allows it, and reconciles every peer, so a reboot or a
  deploy restores the data plane on its own.
- **`GET /api/tunnel/status`** — measured from `wg show`/`ip link`: `status`,
  `activePeers` (live), `configuredPeers`, `livePeers`, `keyMismatch`,
  `ipForward`, `endpointSource`, `endpointWarning`.

## Run

```sh
pnpm --filter server dev     # dev, loads .env
pnpm --filter server build   # tsc → dist/
pnpm --filter server start   # node dist/index.js
```

Docker: `docker compose up exit-node` (uses `env_file: apps/server/.env`).

## HTTPS

The API itself speaks plain HTTP on `127.0.0.1:3001`. Terminate TLS with Caddy
in front — automatic Let's Encrypt certificates, no code changes:

See [`deployment/Caddyfile`](./deployment/Caddyfile).

Then point the web app at `VPN_API_URL=https://api.yourdomain.com/api`.

> WireGuard's UDP `51820` endpoint is separate from this API and is not
> affected by Caddy.

## Endpoints

- `GET /health` — deployment health check (used by CI)
- `POST /api/peers` — create peer (HMAC-signed)
- `GET /api/peers`, `GET /api/peers/:id` — list/get peers *(currently unauthenticated — see note in `src/api/routes.ts`)*
- `DELETE /api/peers/:id` — revoke peer (HMAC-signed)
- `POST /api/tunnel/up|down` — toggle tunnel (HMAC-signed)
- `GET /api/tunnel/status` — tunnel status
