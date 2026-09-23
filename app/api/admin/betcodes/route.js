import { z } from "zod";
import { ok, pageMeta, parseBody, parseQuery, withApi } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import BetCode from "@/models/BetCode";
import { betCodeSchema, escapeRegex, listQuerySchema, objectId } from "@/lib/validation";
import { BETCODE_STATUS, BETCODE_STATUS_VALUES } from "@/lib/constants";
import { createBetCode, getAdminBetCode, serializeForAdmin } from "@/lib/services/betcodes";
import { getLevelNames } from "@/lib/services/subscriptions";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";

const schema = listQuerySchema(["publishAt", "createdAt", "title", "accessLevel", "status", "expiresAt", "viewCount"], {
  status: z.enum([...BETCODE_STATUS_VALUES, "LIVE"]).optional(),
  category: objectId.optional(),
  accessLevel: z.coerce.number().int().min(0).max(100).optional(),
  featured: z.enum(["1"]).optional(),
});

export const GET = withApi(async (request) => {
  await requirePermission(PERMISSIONS.BETCODES_VIEW);
  const { page, limit, q, sort, order, status, category, accessLevel, featured } = parseQuery(request, schema);
  const now = new Date();
  const filter = {};
  if (status === "LIVE") {
    Object.assign(filter, {
      status: { $in: [BETCODE_STATUS.PUBLISHED, BETCODE_STATUS.SCHEDULED] },
      publishAt: { $lte: now },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    });
  } else if (status) filter.status = status;
  if (category) filter.category = category;
  if (accessLevel !== undefined) filter.accessLevel = accessLevel;
  if (featured) filter.isFeatured = true;
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    const search = [{ title: rx }, { code: rx }, { bookmaker: rx }];
    if (filter.$or) filter.$and = [{ $or: filter.$or }, { $or: search }];
    else filter.$or = search;
    if (filter.$and) delete filter.$or;
  }

  const [items, total, levelNames, counts] = await Promise.all([
    BetCode.find(filter)
      .populate("category", "name slug color")
      .populate("createdBy", "name")
      .sort({ [sort]: order === "asc" ? 1 : -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    BetCode.countDocuments(filter),
    getLevelNames(),
    BetCode.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);

  return ok({
    betCodes: items.map((d) => serializeForAdmin(d, { levelNames, now })),
    counts: Object.fromEntries(counts.map((c) => [c._id, c.count])),
    levelNames,
    meta: pageMeta(page, limit, total),
  });
});

export const POST = withApi(async (request) => {
  const { user: actor, permissions } = await requirePermission(PERMISSIONS.BETCODES_CREATE);
  const body = await parseBody(request, betCodeSchema);
  if (body.releaseType !== "DRAFT" && !permissions.includes(PERMISSIONS.BETCODES_PUBLISH)) {
    body.releaseType = "DRAFT";
  }
  const doc = await createBetCode(body, actor);
  const action =
    doc.status === BETCODE_STATUS.PUBLISHED
      ? AUDIT_ACTIONS.BETCODE_PUBLISHED
      : doc.status === BETCODE_STATUS.SCHEDULED
        ? AUDIT_ACTIONS.BETCODE_SCHEDULED
        : AUDIT_ACTIONS.BETCODE_CREATED;
  await logAudit({
    actor,
    action,
    targetType: "BetCode",
    targetId: doc._id,
    metadata: { title: doc.title, accessLevel: doc.accessLevel, status: doc.status, publishAt: doc.publishAt },
    request,
  });
  const message =
    doc.status === BETCODE_STATUS.PUBLISHED ? "Bet code published" : doc.status === BETCODE_STATUS.SCHEDULED ? "Bet code scheduled" : "Draft saved";
  return ok({ betCode: await getAdminBetCode(doc._id) }, { status: 201, message });
});
