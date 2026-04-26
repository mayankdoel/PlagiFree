import type { NextConfig } from "next";
import { DEFAULT_API_ORIGIN } from "@/lib/runtime-config";

const apiInternalUrl = process.env.API_INTERNAL_URL ?? DEFAULT_API_ORIGIN;

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiInternalUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;

