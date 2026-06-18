import type { NextConfig } from "next";

const isMobile = process.env.BUILD_TARGET === "mobile";

const nextConfig: NextConfig = {
  ...(isMobile ? { output: "export" as const } : {}),
  ...(isMobile ? { images: { unoptimized: true } } : {}),
  env: { BUILD_TARGET: process.env.BUILD_TARGET ?? "web" },
};

export default nextConfig;
