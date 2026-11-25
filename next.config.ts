import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // cacheComponents: true,
  // partialPrefetching: true,
  output: 'export',
  basePath: '/dits',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
