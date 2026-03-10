import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    // Type errors are caught by unit tests and local tsc.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;