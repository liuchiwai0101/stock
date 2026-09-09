import { spawnSync } from "node:child_process";
import { cpSync, existsSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const api = "src/app/api";
const stash = ".pages-stash-api";

const ROOT_ENTRIES = [
  ".nojekyll",
  "index.html",
  "index.txt",
  "404.html",
  "favicon.ico",
  "file.svg",
  "globe.svg",
  "next.svg",
  "vercel.svg",
  "window.svg",
  "_next",
  "data",
  "trades",
  "monitor",
  "learn",
  "pnl",
  "_not-found",
  "404",
];

function run(cmd, args, extraEnv = {}) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function publishDir(fromDir, toDir) {
  rmSync(toDir, { recursive: true, force: true });
  cpSync(fromDir, toDir, { recursive: true });
}

function publishToRepoRoot(fromDir) {
  writeFileSync(".nojekyll", "");
  for (const name of ROOT_ENTRIES) {
    const from = join(fromDir, name);
    if (!existsSync(from)) continue;
    rmSync(name, { recursive: true, force: true });
    cpSync(from, name, { recursive: true });
  }
}

if (existsSync(api)) {
  renameSync(api, stash);
}

try {
  run("npx", ["tsx", "--tsconfig", "tsconfig.json", "scripts/prefetch-us-universe.ts"]);
  run("npx", ["tsx", "--tsconfig", "tsconfig.json", "scripts/prefetch-us-scan.ts"]);
  run("npx", ["tsx", "--tsconfig", "tsconfig.json", "scripts/prefetch-quotes.ts"]);
  run("npx", ["next", "build"], {
    GITHUB_PAGES: "true",
    NEXT_PUBLIC_STATIC_DESK: "true",
    NEXT_PUBLIC_BASE_PATH: process.env.PAGES_BASE_PATH || "/stock",
    PAGES_BASE_PATH: process.env.PAGES_BASE_PATH || "/stock",
  });
  writeFileSync("out/.nojekyll", "");
  publishDir("out", "docs");
  publishToRepoRoot("out");
} finally {
  if (existsSync(stash)) {
    renameSync(stash, api);
  }
}
