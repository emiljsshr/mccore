import type { NextConfig } from "next";
const controlPlane = (process.env.CONTROL_PLANE_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");
const nextConfig: NextConfig = {
  devIndicators: false,
  output: "standalone",
  transpilePackages: ["@mccore/contracts"],
  async rewrites() {
    return [
      { source: "/api/v1/:path*", destination: `${controlPlane}/api/v1/:path*` },
      { source: "/ws/:path*", destination: `${controlPlane}/ws/:path*` },
    ];
  },
};
export default nextConfig;
