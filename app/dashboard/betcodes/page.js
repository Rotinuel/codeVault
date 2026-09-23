import { requireUserPage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { connectDB } from "@/lib/mongodb";
import Category from "@/models/Category";
import { getAccessContext, getLevelNames, levelName } from "@/lib/services/subscriptions";
import { serializeCategory } from "@/lib/serializers";
import { PageHeader, Badge } from "@/components/ui/Primitives";
import { BetCodeBoard } from "@/components/betcodes/BetCodeBoard";

export const metadata = { title: "Bet Codes" };

export default async function BetCodesPage() {
  const user = await requireUserPage();
  await connectDB();
  const [settings, ctx, categories, levelNames] = await Promise.all([
    getSettings(),
    getAccessContext(user),
    Category.find({ isActive: true }).sort({ sortOrder: 1 }).lean(),
    getLevelNames(),
  ]);
  const hasSub = Boolean(ctx.subscription) || ctx.isStaff;
  return (
    <>
      <PageHeader
        eyebrow="Bet codes"
        title="Your bet codes"
        description={
          ctx.isStaff
            ? "Staff preview: you can see every level."
            : hasSub
              ? `Showing codes up to ${levelName(levelNames, ctx.level)} level${ctx.historyDays ? ` · history covers the last ${ctx.historyDays} days` : " · full history"}.`
              : "Free codes are shown below. Subscribe to unlock more."
        }
        actions={hasSub && !ctx.isStaff ? <Badge tone="gold">Access level {ctx.level}</Badge> : null}
      />
      <BetCodeBoard timezone={settings.timezone} categories={categories.map(serializeCategory)} hasSubscription={hasSub} />
    </>
  );
}
