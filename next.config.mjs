/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Support for base path from environment variable
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  // Asset prefix for static assets
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || "",
  // Rewrite configuration for serving from subdirectory
  async rewrites() {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

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
