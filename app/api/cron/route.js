import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { runScheduledJobs } from "@/lib/jobs";

export const maxDuration = 60;

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Vercel Cron calls this with "Authorization: Bearer <CRON_SECRET>".
// Any external scheduler (cron-job.org, GitHub Actions, `bun run jobs`) can do the same.
export async function GET(request) {
  if (!authorized(request)) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runScheduledJobs();
    return NextResponse.json({ success: true, data: result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[cron] failed:", error);
    return NextResponse.json({ success: false, message: "Job run failed" }, { status: 500 });
  }
}
