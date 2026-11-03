import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@vcp/core", "@vcp/db", "@vcp/provider-blob-local"],
  serverExternalPackages: ["pg", "drizzle-orm"],
  typedRoutes: false,
};

export default nextConfig;
