import { CalendarCheck, CircleCheck, Trophy } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

/** Monthly target set by the Super Admin, and where the client stands. */
export function RewardProgress({ reward }) {
  if (!reward?.enabled) return null;
  const { target, percent, thisMonth, lastMonth } = reward;
  const pct = Math.min(100, Math.round((thisMonth.approved / target) * 100));

  let lastLine;
  if (lastMonth.qualified && !lastMonth.used) {
    lastLine = `You reached the ${lastMonth.label} target (${lastMonth.approved}/${target}). ${percent}% off is applied automatically to your next subscription payment this month.`;
  } else if (lastMonth.qualified && lastMonth.used) {
    lastLine = `You reached the ${lastMonth.label} target and used your ${percent}% discount${lastMonth.usedAt ? ` on ${formatDate(lastMonth.usedAt)}` : ""}.`;
  } else {
    lastLine = `${lastMonth.label}: ${lastMonth.approved} of ${target} approved uploads, so no discount this month.`;
  }

  return (
    <div className="card overflow-hidden">
      <div className="relative bg-linear-to-br from-ink-900 to-ink-800 p-5 text-white">
        <div className="grid-bg absolute inset-0 opacity-50" aria-hidden="true" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold-400">
              <Trophy className="size-4" aria-hidden="true" /> Monthly winners&apos; reward
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {target} approved upload{target === 1 ? "" : "s"} in a month = {percent}% off
            </p>
            <p className="mt-1 text-sm text-slate-300">
              Reach the target in any month and get {percent}% off one subscription payment the following month.
            </p>
          </div>
          <div className="rounded-xl bg-white/10 px-4 py-3 text-center ring-1 ring-white/10">
            <p className="text-3xl font-bold tabular-nums">
              {thisMonth.approved}
              <span className="text-lg text-slate-400">/{target}</span>
            </p>
            <p className="text-xs text-slate-300">approved in {thisMonth.label.split(" ")[0]}</p>
          </div>
        </div>
        <div className="relative mt-5">
          <div
            className="h-2 overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-valuenow={thisMonth.approved}
            aria-valuemin={0}
            aria-valuemax={target}
            aria-label={`Approved uploads in ${thisMonth.label}`}
          >
            <div className="h-full rounded-full bg-linear-to-r from-gold-400 to-gold-500" style={{ width: `${Math.max(pct, thisMonth.approved ? 4 : 0)}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-300">
            {thisMonth.qualified
              ? `Target reached for ${thisMonth.label}! You'll get ${percent}% off one payment in ${thisMonth.usableIn}.`
              : `${thisMonth.remaining} more approved upload${thisMonth.remaining === 1 ? "" : "s"} this month for ${percent}% off in ${thisMonth.usableIn}.`}
            {thisMonth.pending ? ` ${thisMonth.pending} still waiting for review.` : ""}
          </p>
        </div>
      </div>
      <div className={cn("flex items-start gap-3 p-4 text-sm", reward.discount ? "bg-brand-50 text-brand-900" : "text-slate-600")}>
        {reward.discount ? (
          <CircleCheck className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden="true" />
        ) : (
          <CalendarCheck className="mt-0.5 size-5 shrink-0 text-slate-400" aria-hidden="true" />
        )}
        <p>{lastLine}</p>
      </div>
    </div>
  );
}
