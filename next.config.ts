import type { NextConfig } from "next";

const pagesBasePath =
  process.env.PAGES_BASE_PATH || (process.env.GITHUB_PAGES === "true" ? "/stock" : "");
const isGithubPages = process.env.GITHUB_PAGES === "true" || Boolean(process.env.PAGES_BASE_PATH);

const nextConfig: NextConfig = {
  ...(isGithubPages
    ? {
        output: "export" as const,
        basePath: pagesBasePath || "/stock",
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
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
    "*.github.io",
    "127.0.0.1",
    "localhost",
  ],
};

export default nextConfig;
