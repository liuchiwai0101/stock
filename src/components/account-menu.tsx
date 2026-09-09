"use client";

import { useState, useSyncExternalStore } from "react";
import { LogIn, LogOut, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getAccountSnapshot,
  getServerAccountSnapshot,
  loginAndSync,
  logoutAndSync,
  subscribeAccount,
} from "@/lib/account-store";
import { listHardcodedUsernames } from "@/lib/hardcoded-accounts";

export function AccountMenu() {
  const user = useSyncExternalStore(subscribeAccount, getAccountSnapshot, getServerAccountSnapshot);
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState(listHardcodedUsernames()[0] ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await loginAndSync(username, password);
      setOpen(false);
      setPassword("");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await logoutAndSync();
    window.location.reload();
  }

  return (
    <div className="relative shrink-0">
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 px-2.5 text-xs"
        onClick={() => setOpen((v) => !v)}
      >
        <UserRound className="size-3.5" />
        {user ? user.username : "Account"}
      </Button>

      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-72 rounded-lg border border-white/10 bg-[#121820] p-3 shadow-2xl">
          {user ? (
            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium">{user.username}</div>
                <p className="text-[11px] text-white/45">
                  Watchlist and US scan results save to this account
                </p>
              </div>
              <Button size="sm" variant="outline" className="w-full" onClick={() => void signOut()}>
                <LogOut className="size-3.5" /> Sign out
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <p className="text-[11px] text-white/50">Sign in with a desk account</p>
              <select
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-9 w-full rounded-md border border-white/10 bg-white/3 px-2 text-sm text-white"
              >
                {listHardcodedUsernames().map((name) => (
                  <option key={name} value={name} className="bg-[#121820]">
                    {name}
                  </option>
                ))}
              </select>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="h-9 bg-white/3"
                autoComplete="current-password"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submit();
                }}
              />
              {error ? <p className="text-[11px] text-rose-300">{error}</p> : null}
              <Button size="sm" className="w-full" disabled={busy} onClick={() => void submit()}>
                <LogIn className="size-3.5" />
                Sign in
              </Button>
              <p className="text-[10px] leading-relaxed text-white/40">
                Accounts are assigned by the desk. Default password is username + 123 (e.g. Vin → Vin123).
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
