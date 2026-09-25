// Run with: bun test
import { describe, expect, test } from "bun:test";
import { accessLevelOf, canAccessLevel, daysRemaining, isSubscriptionActive, upgradeCreditDays } from "../lib/access.js";
import { canManageUser, getRolePermissions, PERMISSIONS, SUPER_ADMIN_ONLY_PERMISSIONS } from "../lib/permissions.js";
import { dayBoundsInZone, utcToZonedParts, zonedTimeToUtc } from "../lib/timezone.js";
import { toSubunit, validateGatewayTransaction } from "../lib/payment-validation.js";

const DAY = 86_400_000;
const now = new Date("2026-09-23T12:00:00Z");
const sub = (over = {}) => ({
  status: "ACTIVE",
  startDate: new Date(now.getTime() - DAY),
  endDate: new Date(now.getTime() + 10 * DAY),
  accessLevel: 3,
  ...over,
});

describe("subscription access rule (Premium = level 3)", () => {
  const level = accessLevelOf(sub(), now);
  test.each([
    ["Basic", 1, true],
    ["Standard", 2, true],
    ["Premium", 3, true],
    ["VIP", 4, false],
  ])("%s code (level %i) → %s", (_name, required, allowed) => {
    expect(canAccessLevel(level, required)).toBe(allowed);
  });

  test("Basic subscriber cannot access levels 2, 3, 4", () => {
    const basic = accessLevelOf(sub({ accessLevel: 1 }), now);
    expect([2, 3, 4].map((l) => canAccessLevel(basic, l))).toEqual([false, false, false]);
    expect(canAccessLevel(basic, 1)).toBe(true);
  });

  test("free (level 0) content is open to everyone, nothing else is", () => {
    expect(canAccessLevel(0, 0)).toBe(true);
    expect(canAccessLevel(0, 1)).toBe(false);
  });

  test("garbage input never grants access", () => {
    expect(canAccessLevel("3", "abc")).toBe(false);
    expect(canAccessLevel(undefined, 1)).toBe(false);
    expect(canAccessLevel(NaN, 0)).toBe(false);
  });
});

describe("subscription expiry", () => {
  test("expired end date → treated as unsubscribed", () => {
    const s = sub({ endDate: new Date(now.getTime() - 1000) });
    expect(isSubscriptionActive(s, now)).toBe(false);
    expect(accessLevelOf(s, now)).toBe(0);
  });
  test("end date exactly now → expired", () => {
    expect(isSubscriptionActive(sub({ endDate: now }), now)).toBe(false);
  });
  test("non-ACTIVE statuses grant nothing", () => {
    for (const status of ["EXPIRED", "CANCELLED", "PENDING"]) {
      expect(accessLevelOf(sub({ status }), now)).toBe(0);
    }
  });
  test("future start date (queued plan) grants nothing yet", () => {
    expect(isSubscriptionActive(sub({ startDate: new Date(now.getTime() + DAY) }), now)).toBe(false);
  });
  test("days remaining rounds up and never goes negative", () => {
    expect(daysRemaining(new Date(now.getTime() + 1.2 * DAY), now)).toBe(2);
    expect(daysRemaining(new Date(now.getTime() - DAY), now)).toBe(0);
  });
});

describe("upgrade credit", () => {
  test("unused value converts to days on the new plan", () => {
    // 15 of 30 days left on ₦10,000 plan (₦333/day) → ₦5,000 value; new plan ₦20,000/30d (₦667/day) → 7 days
    const credit = upgradeCreditDays({
      currentEndDate: new Date(now.getTime() + 15 * DAY),
      currentPrice: 10000,
      currentDurationDays: 30,
      newPrice: 20000,
      newDurationDays: 30,
      now,
    });
    expect(credit).toBe(7);
  });
  test("free current plan earns no credit", () => {
    expect(upgradeCreditDays({ currentEndDate: new Date(now.getTime() + 5 * DAY), currentPrice: 0, currentDurationDays: 7, newPrice: 5000, newDurationDays: 30, now })).toBe(0);
  });
});

describe("RBAC", () => {
  test("admins can never receive super-admin-only permissions, even if stored", () => {
    const perms = getRolePermissions("ADMIN", [...SUPER_ADMIN_ONLY_PERMISSIONS, PERMISSIONS.BETCODES_CREATE]);
    expect(perms).toEqual([PERMISSIONS.BETCODES_CREATE]);
  });
  test("users have no admin permissions", () => {
    expect(getRolePermissions("USER")).toEqual([]);
  });
  test("super admin has everything", () => {
    expect(getRolePermissions("SUPER_ADMIN")).toContain(PERMISSIONS.ADMINS_MANAGE);
  });
  test("admins may manage users but not staff; nobody manages themselves", () => {
    const admin = { _id: "a", role: "ADMIN" };
    const sup = { _id: "s", role: "SUPER_ADMIN" };
    expect(canManageUser(admin, { _id: "u", role: "USER" })).toBe(true);
    expect(canManageUser(admin, { _id: "b", role: "ADMIN" })).toBe(false);
    expect(canManageUser(admin, sup)).toBe(false);
    expect(canManageUser(sup, admin)).toBe(true);
    expect(canManageUser(sup, sup)).toBe(false);
  });
});

describe("timezone scheduling", () => {
  test("13:00 in Lagos (UTC+1) is 12:00 UTC", () => {
    expect(zonedTimeToUtc("2026-09-23", "13:00", "Africa/Lagos").toISOString()).toBe("2026-09-23T12:00:00.000Z");
  });
  test("handles DST (New York summer = UTC-4, winter = UTC-5)", () => {
    expect(zonedTimeToUtc("2026-07-01", "10:00", "America/New_York").toISOString()).toBe("2026-07-01T14:00:00.000Z");
    expect(zonedTimeToUtc("2026-12-01", "10:00", "America/New_York").toISOString()).toBe("2026-12-01T15:00:00.000Z");
  });
  test("round-trips back to wall-clock time", () => {
    const d = zonedTimeToUtc("2026-09-23", "20:00", "Africa/Lagos");
    expect(utcToZonedParts(d, "Africa/Lagos")).toEqual({ date: "2026-09-23", time: "20:00" });
  });
  test("rejects invalid input", () => {
    expect(zonedTimeToUtc("2026-13-01", "10:00", "Africa/Lagos")).toBeNull();
    expect(zonedTimeToUtc("2026-09-23", "25:00", "Africa/Lagos")).toBeNull();
    expect(zonedTimeToUtc("2026-09-23", "10:00", "Not/AZone")).toBeNull();
  });
  test("day bounds for Lagos 'today'", () => {
    const { start, end } = dayBoundsInZone("Africa/Lagos", new Date("2026-09-23T23:30:00Z")); // 00:30 on the 24th in Lagos
    expect(start.toISOString()).toBe("2026-09-23T23:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-24T23:00:00.000Z");
  });
});

describe("Paystack verification guard", () => {
  const payment = { _id: "p1", user: "u1", reference: "SUB_ABC123", amount: 20000, currency: "NGN" };
  const good = { reference: "SUB_ABC123", amount: 2000000, currency: "NGN", metadata: JSON.stringify({ userId: "u1", paymentId: "p1" }) };

  test("matching transaction passes", () => {
    expect(validateGatewayTransaction(payment, good)).toEqual([]);
  });
  test("underpayment is rejected", () => {
    expect(validateGatewayTransaction(payment, { ...good, amount: 200000 })).toContain("amount");
  });
  test("fees passed to the customer are accepted (requested_amount)", () => {
    expect(validateGatewayTransaction(payment, { ...good, amount: 2030000, requested_amount: 2000000, fees: 30000 })).toEqual([]);
  });
  test("fees passed to the customer are accepted (amount - fees)", () => {
    expect(validateGatewayTransaction(payment, { ...good, amount: 2030000, fees: 30000 })).toEqual([]);
  });
  test("overpayment that isn't explained by fees is rejected", () => {
    expect(validateGatewayTransaction(payment, { ...good, amount: 2500000, requested_amount: 2500000, fees: 30000 })).toContain("amount");
  });
  test("underpayment is rejected even if requested_amount claims otherwise", () => {
    expect(validateGatewayTransaction(payment, { ...good, amount: 1000000, requested_amount: 2000000 })).toContain("amount");
  });
  test("different currency is rejected", () => {
    expect(validateGatewayTransaction(payment, { ...good, currency: "USD" })).toContain("currency");
  });
  test("someone else's transaction is rejected", () => {
    expect(validateGatewayTransaction(payment, { ...good, metadata: { userId: "u2", paymentId: "p1" } })).toContain("user");
  });
  test("reference mismatch is rejected", () => {
    expect(validateGatewayTransaction(payment, { ...good, reference: "SUB_OTHER" })).toContain("reference");
  });
  test("kobo conversion avoids float errors", () => {
    expect(toSubunit(19.99)).toBe(1999);
    expect(toSubunit(50000)).toBe(5000000);
  });
});

import { applyDiscount, evaluateMonthlyReward, monthKey, monthLabel, monthRange, shiftMonth, sniffImageType, ticketDedupeKey } from "../lib/ticket-rewards.js";

describe("Winning-ticket monthly reward", () => {
  const cfg = { enabled: true, monthlyTarget: 5, percent: 15 };
  test("below target: no discount", () => {
    expect(evaluateMonthlyReward(cfg, 4, false)).toMatchObject({ qualified: false, discount: 0 });
  });
  test("target met last month: discount available once", () => {
    expect(evaluateMonthlyReward(cfg, 5, false)).toMatchObject({ qualified: true, available: true, discount: 15 });
    expect(evaluateMonthlyReward(cfg, 9, true)).toMatchObject({ qualified: true, available: false, discount: 0 });
  });
  test("disabled or capped", () => {
    expect(evaluateMonthlyReward({ ...cfg, enabled: false }, 10, false).discount).toBe(0);
    expect(evaluateMonthlyReward({ ...cfg, percent: 150 }, 10, false).discount).toBe(90);
  });
  test("months follow Lagos time", () => {
    // 23:30 UTC on 30 Sep is 00:30 on 1 Oct in Lagos.
    expect(monthKey(new Date("2026-09-30T23:30:00Z"), "Africa/Lagos")).toBe("2026-10");
    expect(monthKey(new Date("2026-09-30T22:30:00Z"), "Africa/Lagos")).toBe("2026-09");
    const { start, end } = monthRange("2026-09", "Africa/Lagos");
    expect(start.toISOString()).toBe("2026-08-31T23:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-30T23:00:00.000Z");
  });
  test("month arithmetic across years", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(monthLabel("2026-09")).toBe("September 2026");
  });
  test("discounted price", () => {
    expect(applyDiscount(10000, 10)).toBe(9000);
    expect(applyDiscount(5000, 0)).toBe(5000);
    expect(applyDiscount(3333, 15)).toBe(2833.05);
    expect(applyDiscount(10000, 100)).toBe(1000); // capped at 90%
  });
  test("duplicate key ignores case and spacing", () => {
    expect(ticketDedupeKey("SportyBet", "ab 12-cd")).toBe(ticketDedupeKey("sportybet", "AB12CD"));
  });
  test("image sniffing", () => {
    expect(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe("image/jpeg");
    expect(sniffImageType(Buffer.from("<svg onload=alert(1)></svg>"))).toBeNull();
  });
});

import { generateCode, hashCode, hashLinkToken, maskEmail, resendWaitSeconds, safeEqualHex, generateLinkToken } from "../lib/verification-codes.js";

describe("Email verification codes", () => {
  test("codes are 6 digits", () => {
    for (let i = 0; i < 200; i++) expect(generateCode()).toMatch(/^\d{6}$/);
  });
  test("code hash is keyed and bound to the user", () => {
    const a = hashCode("u1", "123456", "secret-a");
    expect(safeEqualHex(a, hashCode("u1", " 123456 ", "secret-a"))).toBe(true);
    expect(safeEqualHex(a, hashCode("u2", "123456", "secret-a"))).toBe(false);
    expect(safeEqualHex(a, hashCode("u1", "123456", "secret-b"))).toBe(false);
    expect(safeEqualHex(a, "abc")).toBe(false);
  });
  test("link tokens are long, URL-safe and hashed", () => {
    const t = generateLinkToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(hashLinkToken(t)).toHaveLength(64);
  });
  test("resend cooldown", () => {
    const now = Date.now();
    expect(resendWaitSeconds(null, now)).toBe(0);
    expect(resendWaitSeconds(new Date(now - 10_000), now)).toBe(50);
    expect(resendWaitSeconds(new Date(now - 61_000), now)).toBe(0);
  });
  test("masked email", () => {
    expect(maskEmail("emmanuel@gmail.com")).toBe("em••••••@gmail.com");
    expect(maskEmail("ab@x.io")).toBe("a•@x.io");
  });
});
