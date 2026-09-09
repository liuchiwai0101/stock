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
  registerAndSync,
  subscribeAccount,
} from "@/lib/account-store";
import { cn } from "@/lib/utils";

export function AccountMenu() {
  const user = useSyncExternalStore(subscribeAccount, getAccountSnapshot, getServerAccountSnapshot);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (mode === "register") await registerAndSync(username, password);
      else await loginAndSync(username, password);
      setOpen(false);
      setPassword("");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Account failed");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await logoutAndSync();
    window.location.reload();
  }

  return (
    <div className="relative">
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
              <div className="flex gap-1 rounded-md border border-white/10 bg-white/3 p-0.5">
                <button
                  type="button"
                  className={cn(
                    "flex-1 rounded px-2 py-1 text-xs",
                    mode === "login" ? "bg-sky-400/15 text-sky-100" : "text-white/55",
                  )}
                  onClick={() => setMode("login")}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  className={cn(
                    "flex-1 rounded px-2 py-1 text-xs",
                    mode === "register" ? "bg-sky-400/15 text-sky-100" : "text-white/55",
                  )}
                  onClick={() => setMode("register")}
                >
                  Create
                </button>
              </div>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="h-9 bg-white/3"
                autoComplete="username"
              />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="h-9 bg-white/3"
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submit();
                }}
              />
              {error ? <p className="text-[11px] text-rose-300">{error}</p> : null}
              <Button size="sm" className="w-full" disabled={busy} onClick={() => void submit()}>
                <LogIn className="size-3.5" />
                {mode === "register" ? "Create account" : "Sign in"}
              </Button>
              <p className="text-[10px] leading-relaxed text-white/40">
                Saves your watchlist and full US scan on this device. With the Node/Docker server,
                scans also sync by account (guests by browser session / IP).
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
