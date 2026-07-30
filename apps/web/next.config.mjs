import { config } from "dotenv";
import { resolve } from "node:path";

// Load the repo-root .env so the web server sees DATABASE_URL / REDIS_URL / keys.
config({ path: resolve(process.cwd(), "../../.env") });

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@quorum/db", "@quorum/engine"],
  experimental: {
    // Don't bundle Prisma — load its native query engine from node_modules at runtime.
    serverComponentsExternalPackages: ["@prisma/client"],
  },
  webpack: (cfg, { isServer }) => {
    // Let the engine's ESM ".js" import specifiers resolve to ".ts" sources.
    cfg.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    // Keep Prisma out of the server bundle so it loads its native engine from
    // node_modules at runtime (fixes "could not locate the Query Engine").
    if (isServer) {
      cfg.externals = [...(cfg.externals || []), "@prisma/client", ".prisma/client"];
    }
    return cfg;
  },
};

export default nextConfig;
