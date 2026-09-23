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
