import { ok, parseBody, withApi, Errors } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import Category from "@/models/Category";
import BetCode from "@/models/BetCode";
import { categorySchema } from "@/lib/validation";
import { serializeCategory } from "@/lib/serializers";
import { slugify } from "@/lib/utils";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";

export const GET = withApi(async () => {
  await requirePermission(PERMISSIONS.BETCODES_VIEW);
  const [categories, counts] = await Promise.all([
    Category.find({}).sort({ sortOrder: 1, name: 1 }).lean(),
    BetCode.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }]),
  ]);
  const byId = new Map(counts.map((c) => [String(c._id), c.count]));
  return ok({ categories: categories.map((c) => ({ ...serializeCategory(c), betCodeCount: byId.get(String(c._id)) || 0 })) });
});

export const POST = withApi(async (request) => {
  const { user: actor } = await requirePermission(PERMISSIONS.CATEGORIES_MANAGE);
  const body = await parseBody(request, categorySchema);
  const slug = slugify(body.name);
  if (!slug) throw Errors.badRequest("Category name must contain letters or numbers");
  if (await Category.exists({ slug })) throw Errors.conflict("A category with this name already exists");
  const category = await Category.create({ ...body, slug, createdBy: actor._id });
  await logAudit({ actor, action: AUDIT_ACTIONS.CATEGORY_CREATED, targetType: "Category", targetId: category._id, metadata: { name: category.name }, request });
  return ok({ category: serializeCategory(category) }, { status: 201, message: "Category created" });
});
