import { ok, withApi } from "@/lib/api";
import { connectDB } from "@/lib/mongodb";
import SubscriptionPlan from "@/models/SubscriptionPlan";
import { serializePlan } from "@/lib/serializers";

// Public: active plans with prices straight from MongoDB.
export const GET = withApi(async () => {
  await connectDB();
  const plans = await SubscriptionPlan.find({ isActive: true }).sort({ sortOrder: 1, accessLevel: 1, price: 1 }).lean();
  return ok({ plans: plans.map(serializePlan) });
});
