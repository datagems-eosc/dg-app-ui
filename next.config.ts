import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    NEXT_PUBLIC_DATAGEMS_API_BASE_URL:
      process.env.NEXT_PUBLIC_DATAGEMS_API_BASE_URL,
  },
};

export default nextConfig;
