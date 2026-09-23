import { ok, withApi } from "@/lib/api";
import { connectDB } from "@/lib/mongodb";
import Category from "@/models/Category";
import { serializeCategory } from "@/lib/serializers";

export const GET = withApi(async () => {
  await connectDB();
  const categories = await Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean();
  return ok({ categories: categories.map(serializeCategory) });
});
