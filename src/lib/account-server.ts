import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { canonicalizeTicker } from "@/lib/ticker";
import { findHardcodedAccount, verifyHardcodedPassword } from "@/lib/hardcoded-accounts";
import { vinDefaultSelection } from "@/lib/vin-watchlist";

const DATA_DIR = path.join(process.cwd(), ".data");
const USER_DIR = path.join(DATA_DIR, "users");
const GUEST_DIR = path.join(DATA_DIR, "guest-scans");

export type ServerAccount = {
  id: string;
  username: string;
  createdAt: string;
};

export type ServerUserData = {
  selection?: unknown;
  scan?: unknown;
  scanHistory?: unknown;
  updatedAt: string;
};

async function ensureDirs() {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(USER_DIR, { recursive: true });
  await mkdir(GUEST_DIR, { recursive: true });
}

function mergeVinSelection(existing: unknown): ReturnType<typeof vinDefaultSelection> {
  const seeded = vinDefaultSelection();
  const prev = (existing ?? {}) as { symbols?: string[]; active?: string; horizon?: number };
  const symbols = [
    ...new Set([
      ...(Array.isArray(prev.symbols) ? prev.symbols.map((s) => canonicalizeTicker(String(s))) : []),
      ...seeded.symbols,
    ]),
  ].slice(0, 20);
  return {
    symbols,
    active: symbols.includes(canonicalizeTicker(String(prev.active ?? "")))
      ? canonicalizeTicker(String(prev.active))
      : seeded.active,
    horizon: 21,
  };
}

export async function loginServerAccount(username: string, password: string): Promise<ServerAccount> {
  const account = findHardcodedAccount(username);
  if (!account) throw new Error("Account not found");
  if (!verifyHardcodedPassword(account.username, password)) throw new Error("Wrong password");
  if (account.username === "Vin") {
    const data = await readUserData(account.id);
    await writeUserData(account.id, {
      ...data,
      selection: mergeVinSelection(data.selection),
    });
  }
  return {
    id: account.id,
    username: account.username,
    createdAt: new Date().toISOString(),
  };
}

export async function readUserData(userId: string): Promise<ServerUserData> {
  try {
    const raw = await readFile(path.join(USER_DIR, `${userId}.json`), "utf8");
    return JSON.parse(raw) as ServerUserData;
  } catch {
    return { updatedAt: new Date().toISOString() };
  }
}

export async function writeUserData(userId: string, data: Omit<ServerUserData, "updatedAt">) {
  await ensureDirs();
  const prev = await readUserData(userId);
  const payload: ServerUserData = {
    ...prev,
    ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)),
    updatedAt: new Date().toISOString(),
  };
  await writeFile(path.join(USER_DIR, `${userId}.json`), JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

export function ipHash(ip: string): string {
  return createHash("sha256").update(ip || "unknown").digest("hex").slice(0, 24);
}

export async function writeGuestScan(scopeOrIp: string, scan: unknown) {
  await ensureDirs();
  const key = scopeOrIp.replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 80);
  await writeFile(
    path.join(GUEST_DIR, `${key}.json`),
    JSON.stringify({ scan, updatedAt: new Date().toISOString() }, null, 2),
    "utf8",
  );
}

export async function readGuestScan(scopeOrIp: string): Promise<unknown | null> {
  try {
    const key = scopeOrIp.replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 80);
    const raw = await readFile(path.join(GUEST_DIR, `${key}.json`), "utf8");
    const parsed = JSON.parse(raw) as { scan?: unknown };
    return parsed.scan ?? null;
  } catch {
    return null;
  }
}
