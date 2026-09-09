"use client";

import type { ReactNode } from "react";
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

export function AppNav({
  subtitle,
  right,
}: {
  subtitle?: string;
  right?: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-white/8 bg-[#0b1016]/92 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1100px] items-start justify-between gap-3 px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/25">
              <Activity className="size-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-tight">Signal Desk</div>
              <div className="truncate text-[11px] text-white/45">{subtitle ?? "Paper forecasts"}</div>
            </div>
          </div>
          <nav className="flex shrink-0 items-center gap-0.5 rounded-lg border border-white/10 bg-white/3 p-0.5">
            {LINKS.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" || pathname === "" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] transition sm:px-2.5 sm:text-xs",
                    active
                      ? "bg-sky-400/15 text-sky-100"
                      : "text-white/55 hover:bg-white/5 hover:text-white/85",
                  )}
                >
                  <Icon className="size-3.5" />
                  <span className="hidden xs:inline sm:inline">{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex shrink-0 items-start gap-3">
          {right ? (
            <div className="flex flex-col items-end gap-0.5 text-right leading-tight">{right}</div>
          ) : null}
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
