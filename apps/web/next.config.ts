import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@servicebox/db", "@servicebox/shared"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
