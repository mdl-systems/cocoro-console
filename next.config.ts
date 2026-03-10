import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Type errors are caught by unit tests and local tsc.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;