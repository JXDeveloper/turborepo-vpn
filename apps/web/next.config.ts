import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
};

module.exports = {
  allowedDevOrigins: ["10.31.175.94", "192.168.2.220"],
};

export default nextConfig;
