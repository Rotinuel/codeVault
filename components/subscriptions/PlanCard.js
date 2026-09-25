import { Check, Crown } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

function durationLabel(days) {
  if (days === 1) return "day";
  if (days === 7) return "week";
  if (days === 30 || days === 31) return "month";
  if (days === 90) return "quarter";
  if (days === 365) return "year";
  return `${days} days`;
}

/** Presentational plan card; the CTA is passed in so it works in server and client trees. */
export function PlanCard({ plan, action, highlight = false, current = false, dark = false, discountPercent = 0 }) {
  const featured = highlight || plan.isFeatured;
  const discounted = discountPercent > 0 && plan.price > 0 ? Math.round(plan.price * (100 - discountPercent)) / 100 : null;
  return (
    <div
      className={cn(
        "relative flex h-full flex-col rounded-2xl p-6 transition-shadow",
        dark
          ? featured
            ? "bg-linear-to-b from-brand-500/15 to-white/[0.03] ring-1 ring-brand-400/50"
            : "bg-white/[0.03] ring-1 ring-white/10"
          : featured
            ? "bg-white ring-2 ring-brand-500 shadow-lg shadow-brand-900/5"
            : "bg-white ring-1 ring-slate-200 shadow-(--shadow-card)"
      )}
    >
      {(plan.badge || featured || current) && (
        <span
          className={cn(
            "absolute -top-3 left-6 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider",
            current ? "bg-ink-900 text-white" : "bg-brand-600 text-white"
          )}
        >
          {current ? "Your plan" : plan.badge || "Most popular"}
        </span>
      )}
      <div className="flex items-center gap-2">
        {plan.accessLevel >= 3 && <Crown className="size-4 text-gold-500" aria-hidden="true" />}
        <h3 className={cn("text-lg font-semibold", dark ? "text-white" : "text-slate-900")}>{plan.name}</h3>
      </div>
      {plan.description && <p className={cn("mt-1.5 text-sm", dark ? "text-slate-400" : "text-slate-500")}>{plan.description}</p>}
      <p className="mt-5 flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
        {discounted !== null && (
          <span className={cn("text-base tabular-nums line-through", dark ? "text-slate-500" : "text-slate-400")}>{formatCurrency(plan.price, plan.currency)}</span>
        )}
        <span className={cn("text-3xl font-bold tracking-tight tabular-nums", dark ? "text-white" : "text-slate-900")}>
          {plan.price === 0 ? "Free" : formatCurrency(discounted ?? plan.price, plan.currency)}
        </span>
        <span className={cn("text-sm", dark ? "text-slate-400" : "text-slate-500")}>/ {durationLabel(plan.durationDays)}</span>
      </p>
      {discounted !== null && (
        <p className="mt-1.5 inline-flex w-fit rounded-full bg-gold-400/20 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-gold-400/50">
          {discountPercent}% winning-ticket discount
        </p>
      )}
      <p className={cn("mt-1 text-xs", dark ? "text-slate-500" : "text-slate-400")}>
        Access level {plan.accessLevel} · {plan.historyDays ? `${plan.historyDays}-day history` : "full history"}
      </p>
      <ul className="mt-6 flex-1 space-y-2.5">
        {plan.features.map((f) => (
          <li key={f} className={cn("flex gap-2.5 text-sm", dark ? "text-slate-300" : "text-slate-600")}>
            <Check className={cn("mt-0.5 size-4 shrink-0", dark ? "text-brand-400" : "text-brand-600")} aria-hidden="true" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-6">{action}</div>
    </div>
  );
}
