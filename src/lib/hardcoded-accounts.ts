/** Built-in desk accounts — no self-serve registration. Password is always `{Username}123`. */
export const HARDCODED_ACCOUNTS = [
  { id: "acct_vin", username: "Vin" },
] as const;

export type HardcodedAccount = (typeof HARDCODED_ACCOUNTS)[number];

export function defaultPasswordFor(username: string): string {
  return `${username}123`;
}

export function findHardcodedAccount(username: string): HardcodedAccount | null {
  const needle = username.trim().toLowerCase();
  return HARDCODED_ACCOUNTS.find((a) => a.username.toLowerCase() === needle) ?? null;
}

export function verifyHardcodedPassword(username: string, password: string): boolean {
  const account = findHardcodedAccount(username);
  if (!account) return false;
  return password === defaultPasswordFor(account.username);
}

export function listHardcodedUsernames(): string[] {
  return HARDCODED_ACCOUNTS.map((a) => a.username);
}
