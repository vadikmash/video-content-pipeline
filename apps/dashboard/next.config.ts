import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@vcp/core", "@vcp/db", "@vcp/provider-blob-local", "@vcp/provider-fake-source"],
  serverExternalPackages: ["pg", "drizzle-orm"],
  typedRoutes: false,
};

export default nextConfig;
