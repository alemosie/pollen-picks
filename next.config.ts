import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  async redirects() {
    return [
      { source: "/demo", destination: "/demo/pick", permanent: false },
      // Prepare is now Write. Old links (shared, or saved in someone's progress) keep working, query string included.
      { source: "/prepare", destination: "/write", permanent: true },
      { source: "/demo/prepare", destination: "/demo/write", permanent: true },
    ];
  },
};

export default nextConfig;
