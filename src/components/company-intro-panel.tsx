"use client";

import { useEffect, useState } from "react";
import { fetchCompanyIntro, type CompanyIntro } from "@/lib/company-intro";
import { getMergedChineseNames } from "@/lib/chinese-names-store";
import { cn } from "@/lib/utils";

export function CompanyIntroPanel({
  symbol,
  name,
  className,
}: {
  symbol: string;
  name: string;
  className?: string;
}) {
  const [intro, setIntro] = useState<CompanyIntro | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchCompanyIntro(symbol, name, getMergedChineseNames())
      .then((next) => {
        if (alive) setIntro(next);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [symbol, name]);

  return (
    <aside
      className={cn(
        "rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2.5 text-sm",
        className,
      )}
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-medium tracking-wide text-white/40 uppercase">Company</span>
        {intro?.market ? (
          <span className="rounded border border-white/10 px-1.5 py-px text-[10px] text-white/55">
            {intro.market}
          </span>
        ) : null}
        {intro?.sector ? (
          <span className="rounded border border-white/10 px-1.5 py-px text-[10px] text-white/55">
            {intro.sector}
          </span>
        ) : null}
      </div>
      <div className="mb-1 text-[13px] font-medium tracking-tight">{intro?.name ?? name}</div>
      {loading && !intro ? (
        <p className="text-[12px] leading-relaxed text-white/40">Loading company intro…</p>
      ) : (
        <p className="text-[12px] leading-relaxed text-white/65">
          {intro?.summary}
          {intro?.url ? (
            <>
              {" "}
              <a
                href={intro.url}
                target="_blank"
                rel="noreferrer"
                className="text-sky-300/90 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                More
              </a>
            </>
          ) : null}
        </p>
      )}
    </aside>
  );
}
