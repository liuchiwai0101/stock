export type AccountUser = {
  id: string;
  username: string;
  createdAt: string;
};

export type AccountRecord = AccountUser & {
  passwordHash: string;
  salt: string;
};

export type AuthSession = {
  userId: string;
  username: string;
  at: string;
};

export type UserDeskData = {
  selection?: {
    symbols: string[];
    active: string;
    horizon: number;
  };
  scan?: unknown;
  scanHistory?: unknown;
  updatedAt: string;
};

const ACCOUNTS_KEY = "signal-desk-accounts-v1";
const SESSION_KEY = "signal-desk-session-v1";
const GUEST_KEY = "signal-desk-guest-id-v1";

function bytesToHex(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function hashPassword(password: string, saltHex?: string): Promise<{ hash: string; salt: string }> {
  const saltBytes = saltHex
    ? Uint8Array.from(hexToBytes(saltHex))
    : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBytes as BufferSource,
      iterations: 120_000,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );
  return { hash: bytesToHex(bits), salt: bytesToHex(saltBytes) };
}

export async function verifyPassword(password: string, salt: string, expectedHash: string): Promise<boolean> {
  const { hash } = await hashPassword(password, salt);
  return hash === expectedHash;
}

function loadAccounts(): AccountRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AccountRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAccounts(accounts: AccountRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function getGuestId(): string {
  if (typeof window === "undefined") return "server";
  try {
    const existing = window.sessionStorage.getItem(GUEST_KEY) ?? window.localStorage.getItem(GUEST_KEY);
    if (existing) {
      window.sessionStorage.setItem(GUEST_KEY, existing);
      return existing;
    }
    const id = `g_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    window.sessionStorage.setItem(GUEST_KEY, id);
    window.localStorage.setItem(GUEST_KEY, id);
    return id;
  } catch {
    return "guest";
  }
}

export function getSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.userId || !parsed?.username) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setSession(session: AuthSession | null) {
  if (typeof window === "undefined") return;
  if (!session) {
    window.localStorage.removeItem(SESSION_KEY);
    return;
  }
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getStorageScope(): string {
  const session = getSession();
  if (session) return `user:${session.userId}`;
  return `guest:${getGuestId()}`;
}

/** Namespace localStorage keys by the signed-in account or guest browser session. */
export function scopedStorageKey(base: string): string {
  return `${base}::${getStorageScope()}`;
}

export function currentUser(): AccountUser | null {
  const session = getSession();
  if (!session) return null;
  return { id: session.userId, username: session.username, createdAt: session.at };
}

export async function registerAccount(username: string, password: string): Promise<AccountUser> {
  const name = username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(name)) {
    throw new Error("Username must be 3–24 letters, numbers, or _");
  }
  if (password.length < 6) throw new Error("Password must be at least 6 characters");

  const accounts = loadAccounts();
  if (accounts.some((a) => a.username === name)) throw new Error("Username already taken");

  const { hash, salt } = await hashPassword(password);
  const user: AccountRecord = {
    id: crypto.randomUUID(),
    username: name,
    passwordHash: hash,
    salt,
    createdAt: new Date().toISOString(),
  };
  accounts.push(user);
  saveAccounts(accounts);
  setSession({ userId: user.id, username: user.username, at: user.createdAt });
  return { id: user.id, username: user.username, createdAt: user.createdAt };
}

export async function loginAccount(username: string, password: string): Promise<AccountUser> {
  const name = username.trim().toLowerCase();
  const accounts = loadAccounts();
  const match = accounts.find((a) => a.username === name);
  if (!match) throw new Error("Account not found");
  const ok = await verifyPassword(password, match.salt, match.passwordHash);
  if (!ok) throw new Error("Wrong password");
  setSession({ userId: match.id, username: match.username, at: new Date().toISOString() });
  return { id: match.id, username: match.username, createdAt: match.createdAt };
}

export function logoutAccount() {
  setSession(null);
}

export function listLocalUsernames(): string[] {
  return loadAccounts().map((a) => a.username);
}
