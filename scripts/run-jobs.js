#!/usr/bin/env bun
/**
 * Trigger the background job endpoint manually (or from any scheduler):
 *   bun run jobs
 * Calls GET /api/cron with the CRON_SECRET bearer token. Use it locally to
 * release scheduled codes, expire subscriptions and flush the WhatsApp queue.
 */
const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
const secret = process.env.CRON_SECRET;

if (!secret) {
  console.error("CRON_SECRET is not set in your environment (.env.local).");
  process.exit(1);
}

const res = await fetch(`${base}/api/cron`, { headers: { Authorization: `Bearer ${secret}` } });
const body = await res.json().catch(() => ({}));
console.log(res.status, JSON.stringify(body, null, 2));
process.exit(res.ok ? 0 : 1);
