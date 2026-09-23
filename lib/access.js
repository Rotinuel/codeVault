// Pure, dependency-free access rules. These are the single source of truth for
// "can a subscriber at level X see content at level Y". Server code imports
// these; the UI may import them only for cosmetic hints (never for enforcement).

import { FREE_ACCESS_LEVEL, SUBSCRIPTION_STATUS } from "./constants.js";

/**
 * A subscription grants access only when it is ACTIVE, has started, and has
 * not reached its end date. Anything else is treated as "no subscription".
 */
export function isSubscriptionActive(subscription, now = new Date()) {
  if (!subscription) return false;
  if (subscription.status !== SUBSCRIPTION_STATUS.ACTIVE) return false;
  const start = subscription.startDate ? new Date(subscription.startDate) : null;
  const end = subscription.endDate ? new Date(subscription.endDate) : null;
  if (!end || Number.isNaN(end.getTime())) return false;
  if (start && start > now) return false;
  return end > now;
}

/** Effective access level for a subscription (0 = free / unsubscribed). */
export function accessLevelOf(subscription, now = new Date()) {
  if (!isSubscriptionActive(subscription, now)) return FREE_ACCESS_LEVEL;
  const level = Number(subscription.accessLevel);
  return Number.isFinite(level) && level > 0 ? level : FREE_ACCESS_LEVEL;
}

/**
 * Core rule: a user at level N may access content requiring level <= N.
 *   Premium (3) → Basic (1) ALLOW, Standard (2) ALLOW, Premium (3) ALLOW, VIP (4) DENY
 */
export function canAccessLevel(userLevel, requiredLevel) {
  const u = Number(userLevel);
  const r = Number(requiredLevel);
  if (!Number.isFinite(u) || !Number.isFinite(r)) return false;
  return u >= r;
}

/** Days remaining (ceil) until a date; never negative. */
export function daysRemaining(endDate, now = new Date()) {
  if (!endDate) return 0;
  const ms = new Date(endDate).getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / 86_400_000);
}

/**
 * Converts the unused part of a current subscription into extra days on a new
 * plan, weighted by daily value, so upgrades never lose paid-for time.
 */
export function upgradeCreditDays({ currentEndDate, currentPrice, currentDurationDays, newPrice, newDurationDays, now = new Date() }) {
  const remainingMs = new Date(currentEndDate).getTime() - now.getTime();
  if (remainingMs <= 0) return 0;
  const remainingDays = remainingMs / 86_400_000;
  const currentDaily = currentDurationDays > 0 ? Number(currentPrice) / currentDurationDays : 0;
  const newDaily = newDurationDays > 0 ? Number(newPrice) / newDurationDays : 0;
  if (currentDaily <= 0 || newDaily <= 0) return 0;
  const credit = Math.floor((remainingDays * currentDaily) / newDaily);
  return Math.max(0, Math.min(credit, 3650));
}
