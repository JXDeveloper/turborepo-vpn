import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Dev-only: extra origins allowed to request the dev server.
  // Set as a comma-separated list in .env.local, e.g. your LAN IP when
  // opening the dev server from a phone: ALLOWED_DEV_ORIGINS=192.168.1.10
  allowedDevOrigins: (process.env.ALLOWED_DEV_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};

export default nextConfig;
