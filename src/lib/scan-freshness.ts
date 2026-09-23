import { CAPTURE_TIMEZONE, dateKeyInTimeZone } from "@/lib/market-hours";
import { todayCaptureKey } from "@/lib/scan-history";

/** A scan is fresh when it was captured on today's date in the capture timezone. */
export function isScanFreshToday(
  generatedAt: string | null | undefined,
  now = new Date(),
  timeZone = CAPTURE_TIMEZONE,
): boolean {
  if (!generatedAt) return false;
  const captured = new Date(generatedAt);
  if (Number.isNaN(captured.getTime())) return false;
  return dateKeyInTimeZone(captured, timeZone) === todayCaptureKey(now, timeZone);
}

export function scanFreshnessLabel(
  generatedAt: string | null | undefined,
  now = new Date(),
): "fresh" | "stale" | "missing" {
  if (!generatedAt) return "missing";
  return isScanFreshToday(generatedAt, now) ? "fresh" : "stale";
}
