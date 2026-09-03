import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Cursor Cloud / agent preview proxies to hit the Next.js dev server.
  allowedDevOrigins: [
    "*.cursor.sh",
    "*.cursor.com",
    "*.cursorusercontent.com",
    "*.onrender.com",
    "127.0.0.1",
    "localhost",
  ],
};

export default nextConfig;
