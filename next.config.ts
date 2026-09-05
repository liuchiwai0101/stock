import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingExcludes: {
    "*": ["./.data/**"],
  },
  // Allow Cursor Cloud / agent preview proxies and phone tunnels to hit the Next.js dev server.
  allowedDevOrigins: [
    "*",
    "*.cursor.sh",
    "*.cursor.com",
    "*.cursorusercontent.com",
    "*.onrender.com",
    "*.loca.lt",
    "*.localtunnel.me",
    "*.trycloudflare.com",
    "127.0.0.1",
    "localhost",
  ],
};

export default nextConfig;
