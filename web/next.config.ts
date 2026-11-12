import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: false,
  // Self-contained server for the Docker image (web/Dockerfile)
  output: "standalone",
  experimental: {
    // Image uploads go through a Server Action; the API caps files at 10 MB
    serverActions: { bodySizeLimit: "11mb" },
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
