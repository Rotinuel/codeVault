import { requireUserPage } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import SubscriptionPlan from "@/models/SubscriptionPlan";
import Subscription from "@/models/Subscription";
import { getAccessContext, getLevelNames, levelName, serializeSubscription } from "@/lib/services/subscriptions";
import { serializePlan } from "@/lib/serializers";
import { PageHeader, Card, CardHeader, StatusBadge, EmptyState } from "@/components/ui/Primitives";
import { SubscriptionPanel } from "@/components/subscriptions/SubscriptionPanel";
import { PlansGrid } from "@/components/subscriptions/PlansGrid";
import { formatCurrency, formatDate, titleCase } from "@/lib/utils";

export const metadata = { title: "Subscription" };

export default async function SubscriptionPage({ searchParams }) {
  const sp = await searchParams;
  const user = await requireUserPage();
  await connectDB();
  const [ctx, plans, history, levelNames] = await Promise.all([
    getAccessContext(user),
    SubscriptionPlan.find({ isActive: true }).sort({ sortOrder: 1, accessLevel: 1, price: 1 }).lean(),
    Subscription.find({ user: user._id }).sort({ createdAt: -1 }).limit(10).lean(),
    getLevelNames(),
  ]);
  const current = serializeSubscription(ctx.subscription);
  const maxLevel = Math.max(0, ...plans.map((p) => p.accessLevel));

  return (
    <>
      <PageHeader eyebrow="Subscription" title="Plans & billing" description="Upgrade, renew, or review your subscription. Payments are processed securely by Paystack." />

      <SubscriptionPanel
        subscription={current}
        levelName={current ? levelName(levelNames, current.accessLevel) : ""}
        isStaff={ctx.isStaff}
        canUpgrade={Boolean(current && maxLevel > current.accessLevel)}
      />

      <section id="plans" className="mt-10 scroll-mt-24" aria-labelledby="plans-heading">
        <h2 id="plans-heading" className="text-lg font-semibold text-slate-900">
          Available plans
        </h2>
        <p className="mb-6 text-sm text-slate-500">Higher plans include everything in the plans below them.</p>
        {plans.length ? (
          <PlansGrid plans={plans.map(serializePlan)} current={current} isStaff={ctx.isStaff} highlightRenew={sp?.renew === "1"} />
        ) : (
          <Card>
            <EmptyState title="No plans available" description="Plans will appear here once the administrator publishes them." />
          </Card>
        )}
      </section>

      <Card className="mt-10">
        <CardHeader title="Subscription history" description="Your last 10 subscription periods." />
        {history.length === 0 ? (
          <EmptyState title="No subscriptions yet" description="Your subscription periods will be listed here." />
        ) : (
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">Plan</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Price</th>
                  <th className="px-4 py-3 font-semibold">Start</th>
                  <th className="px-4 py-3 font-semibold">End</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((s) => (
                  <tr key={String(s._id)}>
                    <td className="px-4 py-3 font-medium text-slate-900">{s.planName}</td>
                    <td className="px-4 py-3 text-slate-600">{titleCase(s.type)}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">{formatCurrency(s.price, s.currency)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(s.startDate)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(s.endDate)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status === "ACTIVE" && new Date(s.endDate) <= new Date() ? "EXPIRED" : s.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
