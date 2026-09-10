import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the dev tools bubble while recording demos (it overlaps the bottom nav)
  devIndicators: process.env.DEMO ? false : undefined,
  /* config options here */
};

export default nextConfig;
