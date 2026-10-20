import { apiProxyDestination } from "./lib/api/base-url.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: frontendRoot,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return apiProxyDestination(process.env.NEXT_PUBLIC_API_BASE_URL);
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
}

export default nextConfig
