import { Errors, getRouteId, ok, parseBody, withApi } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import Category from "@/models/Category";
import BetCode from "@/models/BetCode";
import { categoryUpdateSchema } from "@/lib/validation";
import { serializeCategory } from "@/lib/serializers";
import { slugify } from "@/lib/utils";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";

export const PATCH = withApi(async (request, context) => {
  const { user: actor } = await requirePermission(PERMISSIONS.CATEGORIES_MANAGE);
  const id = await getRouteId(context);
  const body = await parseBody(request, categoryUpdateSchema);
  const update = { ...body };
  if (body.name) {
    update.slug = slugify(body.name);
    const clash = await Category.exists({ slug: update.slug, _id: { $ne: id } });
    if (clash) throw Errors.conflict("A category with this name already exists");
  }
  const category = await Category.findByIdAndUpdate(id, { $set: update }, { returnDocument: "after", runValidators: true }).lean();
  if (!category) throw Errors.notFound("Category not found");
  await logAudit({ actor, action: AUDIT_ACTIONS.CATEGORY_UPDATED, targetType: "Category", targetId: id, metadata: { changes: body }, request });
  return ok({ category: serializeCategory(category) }, { message: "Category updated" });
});

export const DELETE = withApi(async (request, context) => {
  const { user: actor } = await requirePermission(PERMISSIONS.CATEGORIES_MANAGE);
  const id = await getRouteId(context);
  const inUse = await BetCode.countDocuments({ category: id });
  if (inUse) {
    throw Errors.conflict(`This category is used by ${inUse} bet code${inUse === 1 ? "" : "s"}. Deactivate it or move those codes first.`);
  }
  const category = await Category.findByIdAndDelete(id).lean();
  if (!category) throw Errors.notFound("Category not found");
  await logAudit({ actor, action: AUDIT_ACTIONS.CATEGORY_DELETED, targetType: "Category", targetId: id, metadata: { name: category.name }, request });
  return ok({ id }, { message: "Category deleted" });
});
