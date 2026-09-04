"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ClipboardList, LineChart, Radar } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Desk", icon: Activity },
  { href: "/monitor", label: "Monitor", icon: Radar },
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
    <header className="sticky top-0 z-20 border-b border-white/8 bg-[#0b1016]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/25">
              <Activity className="size-4" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">Signal Desk</div>
              <div className="text-[11px] text-white/45">{subtitle ?? "Paper forecasts"}</div>
            </div>
          </div>
          <nav className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/3 p-0.5">
            {LINKS.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition",
                    active
                      ? "bg-sky-400/15 text-sky-100"
                      : "text-white/55 hover:bg-white/5 hover:text-white/85",
                  )}
                >
                  <Icon className="size-3.5" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
        {right ? (
          <div className="flex w-full items-center justify-between gap-3 overflow-x-auto text-right sm:w-auto sm:justify-end sm:gap-6">
            {right}
          </div>
        ) : null}
      </div>
    </header>
  );
}
