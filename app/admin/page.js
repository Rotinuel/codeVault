import Link from "next/link";
import { CalendarClock, Crown, Plus, ShieldAlert, Ticket, TrendingUp, UserCheck, Users } from "lucide-react";
import { requireStaffPage } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { connectDB } from "@/lib/mongodb";
import BetCode from "@/models/BetCode";
import { getAnalytics } from "@/lib/services/analytics";
import { effectiveStatus } from "@/lib/services/betcodes";
import { getLevelNames, levelName } from "@/lib/services/subscriptions";
import { dayBoundsInZone } from "@/lib/timezone";
import { Card, CardHeader, EmptyState, PageHeader, StatCard, StatusBadge } from "@/components/ui/Primitives";
import { ButtonLink } from "@/components/ui/Button";
import { formatCurrency, formatDateTime, formatNumber, formatTime } from "@/lib/utils";

export const metadata = { title: "Admin overview" };

export default async function AdminOverviewPage({ searchParams }) {
  const sp = await searchParams;
  const { user, permissions } = await requireStaffPage();
  const settings = await getSettings();
  await connectDB();
  const can = (p) => permissions.includes(p);
  const { start, end } = dayBoundsInZone(settings.timezone);

  const [analytics, todays, levelNames] = await Promise.all([
    can(PERMISSIONS.ANALYTICS_BASIC) ? getAnalytics({ days: 30, full: can(PERMISSIONS.ANALYTICS_FULL) }) : null,
    can(PERMISSIONS.BETCODES_VIEW)
      ? BetCode.find({ status: { $ne: "ARCHIVED" }, publishAt: { $gte: start, $lt: end } })
          .sort({ publishAt: 1 })
          .populate("category", "name color")
          .lean()
      : [],
    getLevelNames(),
  ]);
  const now = new Date();

  return (
    <>
      {sp?.denied && (
        <div role="alert" className="mb-6 flex items-center gap-2 rounded-xl bg-amber-50 p-3.5 text-sm text-amber-900 ring-1 ring-amber-200">
          <ShieldAlert className="size-4" aria-hidden="true" /> You don&apos;t have permission to open that page.
        </div>
      )}
      <PageHeader
        eyebrow="Admin"
        title={`Good to see you, ${user.name.split(" ")[0]}`}
        description="Today's releases and the key numbers for the last 30 days."
        actions={
          can(PERMISSIONS.BETCODES_CREATE) && (
            <ButtonLink href="/admin/betcodes?new=1">
              <Plus className="size-4" aria-hidden="true" /> New bet code
            </ButtonLink>
          )
        }
      />

      {analytics && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total users" value={formatNumber(analytics.users.total)} hint={`+${analytics.users.new} in 30 days`} icon={Users} tone="blue" />
          <StatCard label="Active subscribers" value={formatNumber(analytics.subscribers.active)} hint={`${analytics.subscribers.expired} expired`} icon={UserCheck} tone="brand" />
          {analytics.revenue ? (
            <StatCard label="Revenue (30 days)" value={formatCurrency(analytics.revenue.period, analytics.currency)} hint={`${analytics.revenue.paymentsInPeriod} payments`} icon={TrendingUp} tone="amber" />
          ) : (
            <StatCard label="New subscriptions" value={formatNumber(analytics.subscriptions.new)} hint={`${analytics.subscriptions.renewals} renewals`} icon={Crown} tone="amber" />
          )}
          <StatCard label="Codes published (30d)" value={formatNumber(analytics.betCodes.publishedInPeriod)} hint={`${analytics.betCodes.live} live now`} icon={Ticket} tone="violet" />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Today's release timeline"
            description={`All times in ${settings.timezone}`}
            action={
              can(PERMISSIONS.BETCODES_VIEW) && (
                <Link href="/admin/betcodes" className="text-sm font-medium text-brand-700 hover:text-brand-800">
                  Manage →
                </Link>
              )
            }
          />
          {todays.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Nothing scheduled today"
              description="Schedule codes at intervals (e.g. 10:00, 13:00, 16:00, 20:00) with a batch release."
              action={can(PERMISSIONS.BETCODES_PUBLISH) && <ButtonLink href="/admin/betcodes?batch=1" variant="secondary" size="sm">Plan today&apos;s releases</ButtonLink>}
            />
          ) : (
            <ol className="relative space-y-1 p-5">
              {todays.map((c) => {
                const status = effectiveStatus(c, now);
                return (
                  <li key={String(c._id)} className="flex items-center gap-4 rounded-xl px-3 py-2.5 hover:bg-slate-50">
                    <span className="w-20 shrink-0 font-mono text-sm font-semibold text-slate-900 tabular-nums">{formatTime(c.publishAt, settings.timezone)}</span>
                    <span className={`size-2.5 shrink-0 rounded-full ${status === "PUBLISHED" ? "bg-brand-500" : status === "SCHEDULED" ? "bg-sky-500" : "bg-slate-300"}`} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">{c.title}</span>
                      <span className="text-xs text-slate-500">
                        {levelName(levelNames, c.accessLevel)}
                        {c.category ? ` · ${c.category.name}` : ""}
                      </span>
                    </span>
                    <StatusBadge status={status} />
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        <Card>
          <CardHeader title={analytics?.revenue ? "Recent payments" : "Subscribers by plan"} />
          {analytics?.revenue ? (
            analytics.recentPayments.length ? (
              <ul className="divide-y divide-slate-100">
                {analytics.recentPayments.slice(0, 6).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{p.user?.name ?? "—"}</p>
                      <p className="text-xs text-slate-500">
                        {p.planName} · {formatDateTime(p.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums text-slate-900">{formatCurrency(p.amount, p.currency)}</p>
                      <StatusBadge status={p.status} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No payments yet" />
            )
          ) : analytics?.subscribers.byPlan.length ? (
            <ul className="divide-y divide-slate-100">
              {analytics.subscribers.byPlan.map((p) => (
                <li key={p.plan} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="text-slate-700">{p.plan}</span>
                  <span className="font-semibold tabular-nums text-slate-900">{p.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No active subscribers yet" />
          )}
        </Card>
      </div>
    </>
  );
}
