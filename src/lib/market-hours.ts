/** US regular session: Mon–Fri 09:30–16:00 America/New_York */
const US_OPEN = { hour: 9, minute: 30 };
const US_CLOSE = { hour: 16, minute: 0 };

export const CAPTURE_TIMEZONE = "Asia/Hong_Kong";
export const CAPTURE_HOUR = 22;
export const CAPTURE_MINUTE = 0;

function partsInTimeZone(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const weekday = parts.weekday ?? "Mon";
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  return {
    year: parts.year ?? "1970",
    month: parts.month ?? "01",
    day: parts.day ?? "01",
    hour: Number(parts.hour ?? 0),
    minute: Number(parts.minute ?? 0),
    weekday: wd,
  };
}

export function dateKeyInTimeZone(date: Date, timeZone: string): string {
  const p = partsInTimeZone(date, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

export function isUsWeekday(date: Date): boolean {
  const wd = partsInTimeZone(date, "America/New_York").weekday;
  return wd >= 1 && wd <= 5;
}

export function isUsMarketOpen(date: Date = new Date()): boolean {
  if (!isUsWeekday(date)) return false;
  const p = partsInTimeZone(date, "America/New_York");
  const mins = p.hour * 60 + p.minute;
  const open = US_OPEN.hour * 60 + US_OPEN.minute;
  const close = US_CLOSE.hour * 60 + US_CLOSE.minute;
  return mins >= open && mins < close;
}

/** True when local capture clock hits 22:00 in the capture timezone on a US trading weekday. */
export function shouldRunDailyCapture(
  date: Date = new Date(),
  timeZone = CAPTURE_TIMEZONE,
  hour = CAPTURE_HOUR,
  minute = CAPTURE_MINUTE,
): boolean {
  if (!isUsWeekday(date)) return false;
  const p = partsInTimeZone(date, timeZone);
  return p.hour === hour && p.minute === minute;
}
