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
| `WG_ENDPOINT` | recommended on EC2 | public `ip:51820` for client configs (auto-detection returns the private VPC IP) |
| `WG_WAN_INTERFACE` | no | NAT masquerade interface (auto-detected) |
| `WG_SERVER_PUBLIC_KEY` | no | fallback key; `configs/wg0.conf` takes precedence |

- **Local dev:** `cp .env.example .env` and fill it in (loaded automatically by `pnpm dev`).
- **Production:** CI writes `/etc/metro-vpn/exit-node.env` on the host; the
  systemd unit loads it via `EnvironmentFile`.

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
