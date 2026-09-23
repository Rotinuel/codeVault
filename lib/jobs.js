// Background maintenance. Triggered by:
//   • Vercel Cron / any external scheduler hitting GET /api/cron (Bearer CRON_SECRET)
//   • Opportunistically after user traffic (throttled) via `maybeRunJobs()`
// All steps are idempotent, so overlapping runs are safe.
import "server-only";
import { after } from "next/server";
import { connectDB } from "./mongodb.js";
import Setting from "../models/Setting.js";
import { processDueReleases } from "./services/betcodes.js";
import { expireDueSubscriptions, sendExpiryReminders } from "./services/subscriptions.js";
import { reconcilePendingPayments } from "./services/payments.js";
import { processWhatsAppQueue } from "./notifications.js";

export async function runScheduledJobs({ includePayments = true } = {}) {
  await connectDB();
  const started = Date.now();
  const result = {};
  const step = async (name, fn) => {
    try {
      result[name] = await fn();
    } catch (error) {
      console.error(`[jobs] ${name} failed:`, error?.message);
      result[name] = { error: error?.message };
    }
  };
  await step("releases", () => processDueReleases());
  await step("expiry", () => expireDueSubscriptions());
  await step("reminders", () => sendExpiryReminders());
  if (includePayments && process.env.PAYSTACK_SECRET_KEY) await step("payments", () => reconcilePendingPayments());
  await step("whatsapp", () => processWhatsAppQueue({ limit: 100, timeBudgetMs: 20_000 }));
  result.durationMs = Date.now() - started;
  return result;
}

const MIN_INTERVAL_MS = 60_000;

/**
 * Runs jobs at most once per minute across all instances (atomic claim on the
 * settings document), after the response has been sent.
 */
export function maybeRunJobs() {
  try {
    after(async () => {
      try {
        await connectDB();
        const cutoff = new Date(Date.now() - MIN_INTERVAL_MS);
        const claimed = await Setting.findOneAndUpdate(
          { key: "platform", $or: [{ jobsLastRunAt: null }, { jobsLastRunAt: { $lt: cutoff } }] },
          { $set: { jobsLastRunAt: new Date() } }
        );
        if (!claimed) return;
        await runScheduledJobs({ includePayments: false });
      } catch (error) {
        console.error("[jobs] opportunistic run failed:", error?.message);
      }
    });
  } catch {
    // outside a request scope
  }
}
