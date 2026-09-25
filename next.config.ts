import { NextConfig } from "next";

// Local-only build: no static export, so the coach API routes can run in Node.
const nextConfig: NextConfig = {
  trailingSlash: false,
  reactStrictMode: true,
  reactCompiler: true,
  images: {
    unoptimized: true,
  },
  // The Agent SDK spawns its bundled Claude Code binary; bundling breaks that.
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk"],
  headers: async () => [
    {
      source: "/engines/:blob*",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=31536000, immutable",
        },
      ],
    },
  ],
};

export default nextConfig;
