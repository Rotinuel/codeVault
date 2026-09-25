// Pure winning-ticket reward rules (no I/O) so they can be unit-tested and
// shown to clients exactly as the server applies them.
//
// Rule: the Super Admin sets a monthly target and a discount. A client whose
// approved uploads in a calendar month reach the target gets that discount on
// ONE payment during the following month. Months follow the platform timezone.

import { utcToZonedParts, zonedTimeToUtc } from "./timezone.js";

export const MAX_DISCOUNT_PERCENT = 90;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "YYYY-MM" of `date` in `timeZone`. */
export function monthKey(date, timeZone) {
  return utcToZonedParts(date, timeZone).date.slice(0, 7);
}

/** Move a "YYYY-MM" key by `delta` months. */
export function shiftMonth(key, delta) {
  const [y, m] = key.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

/** UTC start (inclusive) and end (exclusive) of a "YYYY-MM" month in `timeZone`. */
export function monthRange(key, timeZone) {
  return {
    start: zonedTimeToUtc(`${key}-01`, "00:00", timeZone),
    end: zonedTimeToUtc(`${shiftMonth(key, 1)}-01`, "00:00", timeZone),
  };
}

/** "September 2026". */
export function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/**
 * The discount a client can use right now.
 * @param {{ enabled: boolean, monthlyTarget: number, percent: number }} cfg
 * @param {number} lastMonthApproved - approved tickets uploaded last month
 * @param {boolean} used - last month's reward already paid for
 */
export function evaluateMonthlyReward(cfg, lastMonthApproved, used) {
  const target = Math.max(1, Math.floor(Number(cfg?.monthlyTarget) || 0));
  const percent = Math.min(Math.max(Math.floor(Number(cfg?.percent) || 0), 0), MAX_DISCOUNT_PERCENT);
  const qualified = Boolean(cfg?.enabled) && percent > 0 && lastMonthApproved >= target;
  return { target, percent, qualified, available: qualified && !used, discount: qualified && !used ? percent : 0 };
}

/** Discounted price in major units, rounded to 2 decimals. Never below zero. */
export function applyDiscount(price, percent) {
  const p = Math.min(Math.max(Number(percent) || 0, 0), MAX_DISCOUNT_PERCENT);
  const value = Math.round(Number(price) * (100 - p)) / 100;
  return Math.max(0, value);
}

/** "BOOKMAKER:TICKETREF" with spacing/case differences removed, for duplicate detection. */
export function ticketDedupeKey(bookmaker, ticketRef) {
  const clean = (v) => String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `${clean(bookmaker)}:${clean(ticketRef)}`;
}

/** Recognise JPEG / PNG / WebP from their magic bytes. Returns the MIME type or null. */
export function sniffImageType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}
