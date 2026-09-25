import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { TICKET_STATUS } from "@/lib/constants";
import WinningTicket from "@/models/WinningTicket";

// Ticket image. Public only when the ticket is approved, the client consented
// and the Super Admin put it on the homepage; otherwise only the uploader and
// ticket reviewers can see it.
export async function GET(request, context) {
  const { id } = await context.params;
  if (!/^[a-f0-9]{24}$/i.test(String(id))) return new NextResponse("Not found", { status: 404 });
  await connectDB();
  // Explicit inclusion also returns image.data, which is hidden (select: false) everywhere else.
  const t = await WinningTicket.findById(id)
    .select({ "image.data": 1, "image.contentType": 1, user: 1, status: 1, showcase: 1, showcaseConsent: 1 })
    .lean();
  if (!t?.image?.data) return new NextResponse("Not found", { status: 404 });

  const isPublic = t.status === TICKET_STATUS.APPROVED && t.showcase && t.showcaseConsent;
  if (!isPublic) {
    const user = await getCurrentUser().catch(() => null);
    const allowed = user && (String(user._id) === String(t.user) || (await hasPermission(user, PERMISSIONS.WINNING_TICKETS_REVIEW)));
    if (!allowed) return new NextResponse("Not found", { status: 404 });
  }

  const raw = t.image.data; // Buffer, or a BSON Binary when read with lean()
  const body = Buffer.isBuffer(raw)
    ? raw
    : raw?.buffer && typeof raw.position === "number"
      ? Buffer.from(raw.buffer.subarray(0, raw.position))
      : Buffer.from(raw.buffer ?? raw);
  return new NextResponse(body, {
    headers: {
      "Content-Type": t.image.contentType || "image/jpeg",
      "Content-Length": String(body.length),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
      // URLs carry a version (?v=updatedAt), so public images can be cached long.
      "Cache-Control": isPublic ? "public, max-age=86400, stale-while-revalidate=604800" : "private, no-store",
    },
  });
}
