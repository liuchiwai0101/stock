import { spawnSync } from "node:child_process";
import { cpSync, existsSync, renameSync, rmSync, writeFileSync } from "node:fs";

const api = "src/app/api";
const stash = ".pages-stash-api";

function run(cmd, args, extraEnv = {}) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (existsSync(api)) {
  renameSync(api, stash);
}

try {
  run("npx", ["tsx", "--tsconfig", "tsconfig.json", "scripts/prefetch-quotes.ts"]);
  run("npx", ["next", "build"], {
    GITHUB_PAGES: "true",
    NEXT_PUBLIC_STATIC_DESK: "true",
    NEXT_PUBLIC_BASE_PATH: process.env.PAGES_BASE_PATH || "/stock",
    PAGES_BASE_PATH: process.env.PAGES_BASE_PATH || "/stock",
  });
  writeFileSync("out/.nojekyll", "");
  rmSync("docs", { recursive: true, force: true });
  cpSync("out", "docs", { recursive: true });
} finally {
  if (existsSync(stash)) {
    renameSync(stash, api);
  }
}
