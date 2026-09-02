import { ShieldCheck, ShieldX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { VerificationSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

export function VerificationBanner({ verification }: { verification: VerificationSummary }) {
  const passed = verification.passed;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between",
        passed ? "border-emerald-500/25 bg-emerald-500/8" : "border-amber-500/25 bg-amber-500/8"
      )}
    >
      <div className="flex items-start gap-2 text-sm">
        {passed ? (
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-400" />
        ) : (
          <ShieldX className="mt-0.5 size-4 shrink-0 text-amber-400" />
        )}
        <div>
          <div className="font-medium">
            Self-verification {passed ? "passed" : "needs review"} — {verification.modelCount} models ·{" "}
            {verification.cases.filter((c) => c.passed).length}/{verification.cases.length} checks
          </div>
          <div className="text-xs text-white/55">
            {passed
              ? "Math suite OK. Each ticker still needs its own passing 1-year backtest before automated signals fire."
              : "Internal model checks failed — inspect before trusting signals."}
          </div>
        </div>
      </div>
      <div className="flex max-h-16 flex-wrap gap-1 overflow-auto">
        {verification.cases.map((c) => (
          <Badge
            key={c.name}
            variant={c.passed ? "secondary" : "destructive"}
            title={c.detail}
            className="text-[10px]"
          >
            {c.passed ? "✓" : "✗"} {c.name.length > 22 ? `${c.name.slice(0, 20)}…` : c.name}
          </Badge>
        ))}
      </div>
    </div>
  );
}
