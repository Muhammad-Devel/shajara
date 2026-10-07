import path from "node:path";
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Workspace packages are shipped as TypeScript source.
  transpilePackages: ["@shajara/auth", "@shajara/database"],
  // Monorepo: trace server files (incl. the Prisma engine) from the repository root.
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  async headers() {
    // A strict Content-Security-Policy (with nonces) is added in the security phase.
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default config;
