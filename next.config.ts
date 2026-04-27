import withFlowbiteReact from "flowbite-react/plugin/nextjs";
import type { NextConfig } from "next";
import packageJson from "./package.json";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const appVersion = packageJson.version;

const nextConfig: NextConfig = {
  basePath,
  assetPrefix: basePath,
  env: {
    NEXT_PUBLIC_DATAGEMS_API_BASE_URL:
      process.env.NEXT_PUBLIC_DATAGEMS_API_BASE_URL,
    NEXT_PUBLIC_APP_VERSION: appVersion,
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

export default withFlowbiteReact(nextConfig);
