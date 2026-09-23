import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Crown, Lock, TimerOff, Trophy } from "lucide-react";
import { requireUserPage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getBetCodeForUser } from "@/lib/services/betcodes";
import { ButtonLink } from "@/components/ui/Button";
import { Badge, StatusBadge } from "@/components/ui/Primitives";
import { LevelBadge } from "@/components/betcodes/BetCodeCard";
import { BetCodeActions } from "@/components/betcodes/BetCodeDetail";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Bet code" };

export default async function BetCodeDetailPage({ params }) {
  const { id } = await params;
  const user = await requireUserPage();
  const settings = await getSettings();
  let result;
  try {
    result = await getBetCodeForUser(user, id);
  } catch (error) {
    if (error?.status === 404) notFound();
    throw error;
  }
  const { betCode: b, authorized } = result;
  const tz = settings.timezone;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard/betcodes" className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to bet codes
      </Link>

      <article className="card overflow-hidden">
        <header className="border-b border-slate-100 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <LevelBadge level={b.accessLevel} name={b.accessLevelName} />
            {b.category && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                <span className="size-2 rounded-full" style={{ backgroundColor: b.category.color }} aria-hidden="true" />
                {b.category.name}
              </span>
            )}
            <StatusBadge status={b.status} />
            {authorized && b.result && b.result !== "PENDING" && (
              <Badge tone={b.result === "WON" ? "green" : b.result === "LOST" ? "red" : "gray"} icon={b.result === "WON" ? Trophy : undefined}>
                {b.result.toLowerCase()}
              </Badge>
            )}
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{b.title}</h1>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4" aria-hidden="true" /> Released {formatDateTime(b.publishAt, tz)}
            </span>
            {b.expiresAt && (
              <span className="inline-flex items-center gap-1.5">
                <TimerOff className="size-4" aria-hidden="true" /> {b.status === "EXPIRED" ? "Expired" : "Expires"} {formatDateTime(b.expiresAt, tz)}
              </span>
            )}
          </p>
        </header>

        {authorized ? (
          <div className="space-y-6 p-6">
            <div className="rounded-2xl border border-dashed border-brand-300 bg-brand-50/60 p-5 text-center">
              {b.bookmaker && <p className="text-xs font-semibold uppercase tracking-widest text-brand-800">{b.bookmaker}</p>}
              <p className="code-font mt-1 break-all text-3xl font-bold text-slate-900 sm:text-4xl">{b.code}</p>
              {b.totalOdds && <p className="mt-2 text-sm text-slate-600">Total odds <span className="font-semibold text-slate-900">{Number(b.totalOdds).toFixed(2)}</span></p>}
              <div className="mt-5 flex justify-center">
                <BetCodeActions id={b.id} code={b.code} initialFavorite={b.favorite} viewed={b.viewed} />
              </div>
            </div>
            {b.description && (
              <section>
                <h2 className="text-sm font-semibold text-slate-900">Description</h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">{b.description}</p>
              </section>
            )}
            {b.analysis && (
              <section>
                <h2 className="text-sm font-semibold text-slate-900">Analysis</h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">{b.analysis}</p>
              </section>
            )}
            <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">
              Bet codes are informational. Outcomes are never guaranteed — please gamble responsibly and only stake what you can afford to lose. 18+.
            </p>
          </div>
        ) : (
          <div className="bg-linear-to-br from-ink-900 to-ink-800 p-8 text-center text-white">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-gold-400/15">
              <Lock className="size-7 text-gold-400" aria-hidden="true" />
            </div>
            <p className="mt-4 text-sm font-bold uppercase tracking-widest text-gold-400">{b.accessLevelName} code</p>
            <p className="mx-auto mt-2 max-w-md text-slate-300">
              {b.lockReason === "HISTORY_LIMIT"
                ? "This code is older than your plan's history window. Upgrade for a longer history."
                : `Upgrade to ${b.accessLevelName} to access this bet code.`}
            </p>
            <ButtonLink href="/dashboard/subscription#plans" variant="gold" className="mt-6">
              <Crown className="size-4" aria-hidden="true" /> See upgrade options
            </ButtonLink>
          </div>
        )}
      </article>
    </div>
  );
}
