import type { NextConfig } from "next";

const apiBase =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://localhost:4000";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_BASE_URL: apiBase.replace(/\/$/, ""),
  },
};

export default nextConfig;
