import { CalendarCheck, CalendarX, Crown, Gauge, Hourglass, Wallet } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Badge, StatusBadge } from "@/components/ui/Primitives";
import { formatCurrency, formatDate } from "@/lib/utils";

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3.5 py-3">
      <Icon className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="truncate text-sm font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

/** Server-rendered summary of the user's current subscription. */
export function SubscriptionPanel({ subscription, levelName, isStaff, canUpgrade = true }) {
  if (!subscription) {
    return (
      <div className="card overflow-hidden">
        <div className="relative bg-linear-to-br from-ink-900 to-ink-800 p-6 text-white">
          <div className="grid-bg absolute inset-0 opacity-60" aria-hidden="true" />
          <div className="relative">
            <Crown className="size-6 text-gold-400" aria-hidden="true" />
            <h2 className="mt-3 text-lg font-semibold">{isStaff ? "Staff access" : "No active subscription"}</h2>
            <p className="mt-1 max-w-md text-sm text-slate-300">
              {isStaff
                ? "As a staff member you can preview every bet code. Client access is always determined by their plan."
                : "Choose a plan to unlock bet codes, release notifications and history."}
            </p>
            {!isStaff && (
              <div className="mt-5 flex flex-wrap gap-2">
                <ButtonLink href="/dashboard/subscription" variant="gold">
                  View plans
                </ButtonLink>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const pct = Math.max(4, Math.min(100, Math.round((subscription.daysRemaining / Math.max(1, subscription.durationDays + (subscription.creditDays || 0))) * 100)));
  return (
    <div className="card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Current plan</p>
          <div className="mt-1 flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">{subscription.planName}</h2>
            <StatusBadge status={subscription.status} />
          </div>
        </div>
        <Badge tone="gold" icon={Crown}>
          Level {subscription.accessLevel} · {levelName}
        </Badge>
      </div>
      <div className="grid gap-2 p-5 sm:grid-cols-2 lg:grid-cols-3">
        <Row icon={Wallet} label="Price" value={formatCurrency(subscription.price, subscription.currency)} />
        <Row icon={CalendarCheck} label="Start date" value={formatDate(subscription.startDate)} />
        <Row icon={CalendarX} label="Expiry date" value={formatDate(subscription.endDate)} />
        <Row icon={Hourglass} label="Days remaining" value={`${subscription.daysRemaining} day${subscription.daysRemaining === 1 ? "" : "s"}`} />
        <Row icon={Gauge} label="Access level" value={`${subscription.accessLevel} (${levelName})`} />
        <Row icon={Crown} label="History" value={subscription.historyDays ? `Last ${subscription.historyDays} days` : "Full history"} />
      </div>
      <div className="px-5 pb-2">
        <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Time remaining">
          <div className="h-full rounded-full bg-linear-to-r from-brand-500 to-brand-600" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2 p-5 pt-3">
        {canUpgrade && (
          <ButtonLink href="/dashboard/subscription#plans" variant="primary" size="sm">
            Upgrade
          </ButtonLink>
        )}
        <ButtonLink href="/dashboard/subscription?renew=1" variant="secondary" size="sm">
          Renew
        </ButtonLink>
        <ButtonLink href="/dashboard/subscription#plans" variant="ghost" size="sm">
          View plans
        </ButtonLink>
      </div>
    </div>
  );
}
