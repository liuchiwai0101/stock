import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), ".data");
const ACCOUNTS_FILE = path.join(DATA_DIR, "accounts.json");
const USER_DIR = path.join(DATA_DIR, "users");
const GUEST_DIR = path.join(DATA_DIR, "guest-scans");

export type ServerAccount = {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
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

function hashPassword(password: string, salt: Buffer): string {
  return scryptSync(password, salt, 32).toString("hex");
}

function verifyPassword(password: string, saltHex: string, expectedHex: string): boolean {
  const salt = Buffer.from(saltHex, "hex");
  const actual = scryptSync(password, salt, 32);
  const expected = Buffer.from(expectedHex, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

async function readAccounts(): Promise<ServerAccount[]> {
  try {
    const raw = await readFile(ACCOUNTS_FILE, "utf8");
    const parsed = JSON.parse(raw) as ServerAccount[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAccounts(accounts: ServerAccount[]) {
  await ensureDirs();
  await writeFile(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2), "utf8");
}

export async function registerServerAccount(username: string, password: string): Promise<ServerAccount> {
  const name = username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(name)) throw new Error("Username must be 3–24 letters, numbers, or _");
  if (password.length < 6) throw new Error("Password must be at least 6 characters");
  const accounts = await readAccounts();
  if (accounts.some((a) => a.username === name)) throw new Error("Username already taken");
  const salt = randomBytes(16);
  const account: ServerAccount = {
    id: randomBytes(16).toString("hex"),
    username: name,
    passwordHash: hashPassword(password, salt),
    salt: salt.toString("hex"),
    createdAt: new Date().toISOString(),
  };
  accounts.push(account);
  await writeAccounts(accounts);
  return account;
}

export async function loginServerAccount(username: string, password: string): Promise<ServerAccount> {
  const name = username.trim().toLowerCase();
  const accounts = await readAccounts();
  const match = accounts.find((a) => a.username === name);
  if (!match) throw new Error("Account not found");
  if (!verifyPassword(password, match.salt, match.passwordHash)) throw new Error("Wrong password");
  return match;
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
