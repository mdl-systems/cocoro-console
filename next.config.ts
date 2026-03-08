import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Type errors are caught by unit tests and local tsc.
    ignoreBuildErrors: true,
  },
  // cocoro-sdk はローカルパッケージなので ESM変換が必要
  transpilePackages: ["@mdl-systems/cocoro-sdk"],
};

export default nextConfig;