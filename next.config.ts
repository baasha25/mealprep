import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Invoice-scan uploads (base64 image/PDF) exceed the 1MB server-action default.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
