import {
  findHardcodedAccount,
  listHardcodedUsernames,
  verifyHardcodedPassword,
} from "@/lib/hardcoded-accounts";

export type AccountUser = {
  id: string;
  username: string;
  createdAt: string;
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

const SESSION_KEY = "signal-desk-session-v1";
const GUEST_KEY = "signal-desk-guest-id-v1";

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
    // Drop sessions for usernames that are no longer hardcoded.
    if (!findHardcodedAccount(parsed.username)) {
      window.localStorage.removeItem(SESSION_KEY);
      return null;
    }
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

export async function loginAccount(username: string, password: string): Promise<AccountUser> {
  const account = findHardcodedAccount(username);
  if (!account) throw new Error("Account not found");
  if (!verifyHardcodedPassword(account.username, password)) throw new Error("Wrong password");
  const at = new Date().toISOString();
  setSession({ userId: account.id, username: account.username, at });
  return { id: account.id, username: account.username, createdAt: at };
}

export function logoutAccount() {
  setSession(null);
}

export function listLocalUsernames(): string[] {
  return listHardcodedUsernames();
}
