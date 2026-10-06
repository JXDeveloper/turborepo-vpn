# metro-vpn

Turborepo monorepo for the metro-vpn product: a WireGuard-based VPN with a web
control plane, desktop client, mobile client, and self-hosted exit node.

## What's inside?

| App / package | Description |
| --- | --- |
| `apps/web` | Next.js control plane (Clerk auth, Drizzle/Neon) — manages peers, deploys to Vercel |
| `apps/desktop` | Electron desktop client (TanStack Router, shadcn/ui, D-Bus + Rust native service) |
| `apps/mobile` | Expo mobile client with a custom WireGuard module |
| `apps/server` | Hono exit-node server (WireGuard + NAT), runs on EC2 behind Caddy HTTPS |
| `packages/crypto-utils` | Shared X25519 keypair + HMAC signing helpers |
| `packages/expo-wireguard` | Expo module wrapping the native WireGuard client |

## Environment variables

No endpoints or secrets are hardcoded — every app reads them from the
environment. Each app ships a `.env.example`; copy it to `.env` (gitignored)
and fill in real values.

| App | Variable | Purpose |
| --- | --- | --- |
| server | `BACKEND_API_SECRET` **(required, secret)** | HMAC secret shared with `apps/web` — validated at startup |
| server | `PORT` | Control API port (default `3001`) |
| server | `WG_ENDPOINT` | Public `ip:51820` written into client configs (auto-detected if unset — set it explicitly on EC2) |
| server | `WG_WAN_INTERFACE` | NAT masquerade interface (auto-detected if unset) |
| server | `WG_SERVER_PUBLIC_KEY` | Fallback WireGuard server public key |
| web | `VPN_API_URL` | Exit-node API base (dev default `http://127.0.0.1:3001/api`, required in production) |
| web | `BACKEND_API_SECRET` **(secret)** | Same secret as the server — signs mutating requests |
| web | `DATABASE_URL` **(secret)** | Neon/Postgres connection string |
| web | `CORS_ALLOWED_ORIGIN` | Comma-separated browser origins allowed for `/api/vpn/peer/create` (default `http://localhost:5173`, e.g. `http://localhost:5173,my-vpn://renderer`) |
| web | `ALLOWED_DEV_ORIGINS` | Comma-separated origins allowed to request `next dev` (e.g. your LAN IP) |
| web | `NEXT_PUBLIC_CLERK_*` | Clerk redirect URLs (declared in `turbo.json` for cache correctness) |
| desktop | `VITE_WEB_API_URL` | API base the renderer calls (or `VITE_WEB_APP_URL` → `${URL}/api`) |
| desktop | `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| mobile | `EXPO_PUBLIC_VPN_API_URL` | Web app base URL used to create peers |

### HTTPS for the exit node

The control API is served as plain HTTP on the host and put behind **Caddy**,
which gets and renews Let's Encrypt certificates automatically — see
[`apps/server/deployment/Caddyfile`](apps/server/deployment/Caddyfile) and
[`apps/server/README.md`](apps/server/README.md). WireGuard's UDP `51820`
endpoint is separate and unaffected.

In production, CI writes the server's runtime env to
`/etc/metro-vpn/exit-node.env` on the EC2 host from GitHub **secrets**
(`BACKEND_API_SECRET`) and **variables** (`WG_ENDPOINT`, `WG_WAN_INTERFACE`).

### Utilities

This Turborepo has some additional tools already setup for you:

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io) for code formatting

### Build

To build all apps and packages, run the following command:

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed (recommended):

```sh
cd my-turborepo
turbo build
```

Without global `turbo`, use your package manager:

```sh
cd my-turborepo
npx turbo build
pnpm dlx turbo build
pnpm exec turbo build
```

You can build a specific package by using a [filter](https://turborepo.dev/docs/crafting-your-repository/running-tasks#using-filters):

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed:

```sh
turbo build --filter=docs
```

Without global `turbo`:

```sh
npx turbo build --filter=docs
pnpm exec turbo build --filter=docs
pnpm exec turbo build --filter=docs
```

### Develop

To develop all apps and packages, run the following command:

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed (recommended):

```sh
cd my-turborepo
turbo dev
```

Without global `turbo`, use your package manager:

```sh
cd my-turborepo
npx turbo dev
pnpm exec turbo dev
pnpm exec turbo dev
```

You can develop a specific package by using a [filter](https://turborepo.dev/docs/crafting-your-repository/running-tasks#using-filters):

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed:

```sh
turbo dev --filter=web
```

Without global `turbo`:

```sh
npx turbo dev --filter=web
pnpm exec turbo dev --filter=web
pnpm exec turbo dev --filter=web
```

### Remote Caching

> [!TIP]
> Vercel Remote Cache is free for all plans. Get started today at [vercel.com](https://vercel.com/signup?utm_source=remote-cache-sdk&utm_campaign=free_remote_cache).

Turborepo can use a technique known as [Remote Caching](https://turborepo.dev/docs/core-concepts/remote-caching) to share cache artifacts across machines, enabling you to share build caches with your team and CI/CD pipelines.

By default, Turborepo will cache locally. To enable Remote Caching you will need an account with Vercel. If you don't have an account you can [create one](https://vercel.com/signup?utm_source=turborepo-examples), then enter the following commands:

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed (recommended):

```sh
cd my-turborepo
turbo login
```

Without global `turbo`, use your package manager:

```sh
cd my-turborepo
npx turbo login
pnpm exec turbo login
pnpm exec turbo login
```

This will authenticate the Turborepo CLI with your [Vercel account](https://vercel.com/docs/concepts/personal-accounts/overview).

Next, you can link your Turborepo to your Remote Cache by running the following command from the root of your Turborepo:

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed:

```sh
turbo link
```

Without global `turbo`:

```sh
npx turbo link
pnpm exec turbo link
pnpm exec turbo link
```

## Useful Links

Learn more about the power of Turborepo:

- [Tasks](https://turborepo.dev/docs/crafting-your-repository/running-tasks)
- [Caching](https://turborepo.dev/docs/crafting-your-repository/caching)
- [Remote Caching](https://turborepo.dev/docs/core-concepts/remote-caching)
- [Filtering](https://turborepo.dev/docs/crafting-your-repository/running-tasks#using-filters)
- [Configuration Options](https://turborepo.dev/docs/reference/configuration)
- [CLI Usage](https://turborepo.dev/docs/reference/command-line-reference)
