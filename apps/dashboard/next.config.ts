import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@vcp/core",
    "@vcp/db",
    "@vcp/limits",
    "@vcp/providers",
    "@vcp/provider-blob-local",
    "@vcp/provider-fake-source",
    "@vcp/provider-source-wikimedia",
  ],
  serverExternalPackages: ["pg", "drizzle-orm"],
  typedRoutes: false,
};

export default nextConfig;
