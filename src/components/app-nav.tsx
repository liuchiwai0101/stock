"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ClipboardList, FlaskConical, LineChart, Radar } from "lucide-react";
import { AccountMenu } from "@/components/account-menu";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Desk", icon: Activity },
  { href: "/monitor", label: "Monitor", icon: Radar },
  { href: "/learn", label: "Learn", icon: FlaskConical },
  { href: "/pnl", label: "P&L", icon: LineChart },
  { href: "/trades", label: "Trades", icon: ClipboardList },
] as const;

/** Fixed top chrome: brand left; primary menu + Account padded to the right. */
export function AppNav({ subtitle }: { subtitle?: string }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 h-14 shrink-0 border-b border-white/8 bg-[#0b1016]/95 backdrop-blur-xl">
      <div className="mx-auto flex h-full w-full max-w-[1100px] items-center gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/25">
            <Activity className="size-3.5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold leading-tight tracking-tight">Signal Desk</div>
            <div className="truncate text-[11px] leading-tight text-white/45">
              {subtitle ?? "Paper forecasts"}
            </div>
          </div>
        </div>

        <div className="ml-auto flex h-9 shrink-0 items-center gap-2.5">
          <nav
            className="flex h-9 shrink-0 items-center gap-0.5 rounded-lg border border-white/10 bg-white/3 p-0.5"
            aria-label="Primary"
          >
            {LINKS.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" || pathname === "" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "inline-flex h-8 items-center gap-1 rounded-md px-2 text-[11px] transition sm:px-2.5 sm:text-xs",
                    active
                      ? "bg-sky-400/15 text-sky-100"
                      : "text-white/55 hover:bg-white/5 hover:text-white/85",
                  )}
                >
                  <Icon className="size-3.5 shrink-0" />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              );
            })}
          </nav>
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
