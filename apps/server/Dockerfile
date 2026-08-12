FROM node:22

WORKDIR /usr/src/app

# Linux networking / WireGuard tools
RUN apt-get update \
  && apt-get install -y \
  wireguard-tools \
  iproute2 \
  iptables \
  iputils-ping \
  ca-certificates \
  curl \
  && rm -rf /var/lib/apt/lists/*

# Enable pnpm
RUN corepack enable

# Copy workspace metadata first
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy package manifests
COPY apps/server/package.json apps/server/package.json
COPY packages/crypto-utils/package.json packages/crypto-utils/package.json
COPY packages/expo-wireguard/package.json packages/expo-wireguard/package.json

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/server apps/server
COPY packages/crypto-utils packages/crypto-utils
COPY packages/expo-wireguard packages/expo-wireguard

# Build server
RUN pnpm --filter server build

# Server HTTP API
EXPOSE 8080 51280/udp 3001

CMD ["pnpm", "--filter", "server", "start"]
