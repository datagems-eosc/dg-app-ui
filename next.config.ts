import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  basePath,
  assetPrefix: basePath,
  env: {
    NEXT_PUBLIC_DATAGEMS_API_BASE_URL:
      process.env.NEXT_PUBLIC_DATAGEMS_API_BASE_URL,
  },
  async rewrites() {
    if (!basePath) {
      return [];
    }
    return [
      {
        source: `${basePath}/:path*`,
        destination: "/:path*",
      },
    ];
  },
};

export default nextConfig;
