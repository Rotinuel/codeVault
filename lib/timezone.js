// Timezone helpers built on Intl (no external dependency). Client-safe.

export function isValidTimeZone(tz) {
  if (!tz || typeof tz !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Offset (ms) of `timeZone` from UTC at the instant `date`. */
export function getTimeZoneOffsetMs(date, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );
  const withoutMs = date.getTime() - date.getUTCMilliseconds();
  return asUtc - withoutMs;
}

/**
 * Convert a wall-clock date ("2026-09-23") and time ("13:00") in `timeZone`
 * into a UTC Date. Handles DST by re-checking the offset at the result.
 */
export function zonedTimeToUtc(dateStr, timeStr, timeZone) {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ""));
  const tm = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(timeStr || ""));
  if (!dm || !tm) return null;
  if (!isValidTimeZone(timeZone)) return null;
  const [, y, mo, d] = dm.map(Number);
  const [, h, mi, s = 0] = tm.map((v) => (v === undefined ? 0 : Number(v)));
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const naive = Date.UTC(y, mo - 1, d, h, mi, s);
  let offset = getTimeZoneOffsetMs(new Date(naive), timeZone);
  let result = naive - offset;
  const offset2 = getTimeZoneOffsetMs(new Date(result), timeZone);
  if (offset2 !== offset) result = naive - offset2;
  return new Date(result);
}

/** Returns { date: "YYYY-MM-DD", time: "HH:mm" } for `date` in `timeZone`. */
export function utcToZonedParts(date, timeZone) {
  const d = new Date(date);
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** Start and end (UTC Dates) of the calendar day containing `now` in `timeZone`. */
export function dayBoundsInZone(timeZone, now = new Date()) {
  const { date } = utcToZonedParts(now, timeZone);
  const start = zonedTimeToUtc(date, "00:00", timeZone);
  const end = new Date(start.getTime() + 86_400_000);
  // Adjust for DST days that are 23/25 hours long.
  const nextDay = utcToZonedParts(end, timeZone);
  const correctedEnd = zonedTimeToUtc(nextDay.date, "00:00", timeZone) ?? end;
  return { start, end: correctedEnd };
}

export const COMMON_TIMEZONES = [
  "Africa/Lagos",
  "Africa/Accra",
  "Africa/Nairobi",
  "Africa/Johannesburg",
  "Africa/Cairo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney",
  "UTC",
];
