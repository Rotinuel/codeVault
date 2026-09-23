import Link from "next/link";
import { CalendarClock, Crown, Eye, ReceiptText, Ticket } from "lucide-react";
import { requireUserPage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { connectDB } from "@/lib/mongodb";
import Category from "@/models/Category";
import Payment from "@/models/Payment";
import SubscriptionPlan from "@/models/SubscriptionPlan";
import { getAccessContext, getLevelNames, levelName, serializeSubscription } from "@/lib/services/subscriptions";
import { getUserBetCodeStats } from "@/lib/services/betcodes";
import { serializeCategory } from "@/lib/serializers";
import { PageHeader, StatCard, StatusBadge } from "@/components/ui/Primitives";
import { SubscriptionPanel } from "@/components/subscriptions/SubscriptionPanel";
import { BetCodeBoard } from "@/components/betcodes/BetCodeBoard";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUserPage();
  await connectDB();
  const [settings, ctx, stats, categories, lastPayment, levelNames, maxLevel] = await Promise.all([
    getSettings(),
    getAccessContext(user),
    getUserBetCodeStats(user),
    Category.find({ isActive: true }).sort({ sortOrder: 1 }).lean(),
    Payment.findOne({ user: user._id }).sort({ createdAt: -1 }).lean(),
    getLevelNames(),
    SubscriptionPlan.findOne({ isActive: true }).sort({ accessLevel: -1 }).select("accessLevel").lean(),
  ]);
  const sub = serializeSubscription(ctx.subscription);
  const firstName = user.name.split(" ")[0];

  return (
    <>
      <PageHeader eyebrow="Overview" title={`Welcome back, ${firstName}`} description="Here's what's available on your plan right now." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Current subscription" value={sub?.planName ?? (ctx.isStaff ? "Staff" : "None")} hint={sub ? `Access level ${sub.accessLevel}` : "Subscribe to unlock codes"} icon={Crown} tone="amber" />
        <StatCard label="Subscription expiry" value={sub ? formatDate(sub.endDate) : "—"} hint={sub ? `${sub.daysRemaining} days remaining` : "No active plan"} icon={CalendarClock} tone="violet" />
        <StatCard label="Available bet codes" value={stats.available} hint={`${stats.today} released today`} icon={Ticket} tone="brand" />
        <StatCard label="Bet codes viewed" value={stats.viewed} hint={`${stats.favorites} favourite${stats.favorites === 1 ? "" : "s"}`} icon={Eye} tone="blue" />
        <StatCard
          label="Payment status"
          value={lastPayment ? <StatusBadge status={lastPayment.status} className="text-sm" /> : "—"}
          hint={lastPayment ? `Last payment ${formatDate(lastPayment.createdAt)}` : "No payments yet"}
          icon={ReceiptText}
          tone="slate"
        />
      </div>

      <div className="mt-6">
        <SubscriptionPanel
          subscription={sub}
          levelName={sub ? levelName(levelNames, sub.accessLevel) : ""}
          isStaff={ctx.isStaff}
          canUpgrade={Boolean(sub && maxLevel && maxLevel.accessLevel > sub.accessLevel)}
        />
      </div>

      <section className="mt-8" aria-labelledby="latest-codes">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 id="latest-codes" className="text-lg font-semibold text-slate-900">
              Latest bet codes
            </h2>
            <p className="text-sm text-slate-500">Only codes included in your plan are shown.</p>
          </div>
          <Link href="/dashboard/betcodes" className="text-sm font-medium text-brand-700 hover:text-brand-800">
            View all →
          </Link>
        </div>
        <BetCodeBoard
          compact
          limit={6}
          timezone={settings.timezone}
          categories={categories.map(serializeCategory)}
          hasSubscription={Boolean(sub) || ctx.isStaff}
        />
      </section>
    </>
  );
}
