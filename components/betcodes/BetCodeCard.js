"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarClock, Check, Clock, Copy, Crown, Lock, Sparkles, Star, TimerOff, Trophy } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/client/api";
import { copyText } from "@/lib/client/hooks";
import { Badge, StatusBadge } from "@/components/ui/Primitives";
import { ButtonLink } from "@/components/ui/Button";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";

export function LevelBadge({ level, name }) {
  if (level === 0) return <Badge tone="gray">Free</Badge>;
  const tone = level >= 4 ? "dark" : level >= 3 ? "gold" : level === 2 ? "blue" : "green";
  return (
    <Badge tone={tone} icon={level >= 3 ? Crown : undefined}>
      {name}
    </Badge>
  );
}

function CategoryChip({ category }) {
  if (!category) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
      <span className="size-2 rounded-full" style={{ backgroundColor: category.color }} aria-hidden="true" />
      {category.name}
    </span>
  );
}

function Countdown({ to }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const ms = Math.max(0, new Date(to).getTime() - now);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return (
    <span className="font-mono tabular-nums" suppressHydrationWarning>
      {h > 0 ? `${h}h ` : ""}
      {String(m).padStart(2, "0")}m {String(s).padStart(2, "0")}s
    </span>
  );
}

const RESULT_TONES = { WON: "green", LOST: "red", VOID: "gray" };

export function BetCodeCard({ item, timezone, onChange }) {
  const [copied, setCopied] = useState(false);
  const [favorite, setFavorite] = useState(Boolean(item.favorite));
  const [busy, setBusy] = useState(false);

  if (item.upcoming) return <UpcomingCard item={item} timezone={timezone} />;
  if (item.locked) return <LockedCard item={item} />;

  const expired = item.status === "EXPIRED";

  async function copy() {
    const ok = await copyText(item.code);
    if (ok) {
      setCopied(true);
      toast.success("Code copied to clipboard");
      setTimeout(() => setCopied(false), 1800);
      if (!item.viewed) apiFetch(`/api/betcodes/${item.id}/view`, { method: "POST" }).catch(() => {});
    } else {
      toast.error("Couldn't copy — select the code manually");
    }
  }

  async function toggleFavorite() {
    setBusy(true);
    const next = !favorite;
    setFavorite(next);
    try {
      await apiFetch(`/api/betcodes/${item.id}/favorite`, { method: "POST", body: { favorite: next } });
      onChange?.();
    } catch (e) {
      setFavorite(!next);
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("card flex flex-col overflow-hidden", item.isFeatured && "ring-2 ring-brand-500/30", expired && "opacity-80")}
    >
      <div className="flex items-center justify-between gap-2 px-5 pt-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <LevelBadge level={item.accessLevel} name={item.accessLevelName} />
          <CategoryChip category={item.category} />
        </div>
        <div className="flex items-center gap-1">
          {item.isFeatured && (
            <Badge tone="green" icon={Sparkles}>
              Featured
            </Badge>
          )}
          <button
            type="button"
            onClick={toggleFavorite}
            disabled={busy}
            className={cn("grid size-8 place-items-center rounded-lg transition-colors", favorite ? "text-amber-500 hover:bg-amber-50" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600")}
            aria-pressed={favorite}
            aria-label={favorite ? "Remove from favourites" : "Add to favourites"}
          >
            <Star className={cn("size-4", favorite && "fill-current")} />
          </button>
        </div>
      </div>

      <div className="px-5 pt-3">
        <Link href={`/dashboard/betcodes/${item.id}`} className="line-clamp-2 text-base font-semibold text-slate-900 hover:text-brand-700">
          {item.title}
        </Link>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden="true" />
            <span suppressHydrationWarning>{formatDateTime(item.publishAt, timezone)}</span>
          </span>
          {item.expiresAt && (
            <span className={cn("inline-flex items-center gap-1", expired && "text-rose-600")}>
              <TimerOff className="size-3.5" aria-hidden="true" />
              <span suppressHydrationWarning>{expired ? "Expired" : `Expires ${timeAgo(item.expiresAt)}`}</span>
            </span>
          )}
        </p>
      </div>

      <div className="mx-5 mt-4 flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-2 pl-4">
        <div className="min-w-0 flex-1">
          {item.bookmaker && <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{item.bookmaker}</p>}
          <p className="code-font truncate text-lg font-semibold text-slate-900" title={item.code}>
            {item.code}
          </p>
        </div>
        <button
          type="button"
          onClick={copy}
          className={cn("inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors", copied ? "bg-brand-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100")}
          aria-label={`Copy code ${item.code}`}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <p className="mx-5 mb-4 mt-3 line-clamp-3 text-sm text-slate-600">{item.description || "\u00a0"}</p>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-3">
        <div className="flex items-center gap-2">
          <StatusBadge status={item.status} />
          {item.result && item.result !== "PENDING" && (
            <Badge tone={RESULT_TONES[item.result]} icon={item.result === "WON" ? Trophy : undefined}>
              {item.result.toLowerCase()}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {item.totalOdds && (
            <span>
              Odds <span className="font-semibold text-slate-800 tabular-nums">{Number(item.totalOdds).toFixed(2)}</span>
            </span>
          )}
          <Link href={`/dashboard/betcodes/${item.id}`} className="font-medium text-brand-700 hover:text-brand-800">
            Details →
          </Link>
        </div>
      </div>
    </motion.article>
  );
}

export function LockedCard({ item }) {
  const reason = item.lockReason === "HISTORY_LIMIT" ? "This code is older than your plan's history window." : `Upgrade to ${item.accessLevelName} to access this bet code.`;
  return (
    <article className="relative flex flex-col overflow-hidden rounded-(--radius-card) border border-slate-800 bg-linear-to-br from-ink-900 via-ink-900 to-ink-800 p-5 text-white shadow-(--shadow-card)">
      <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-gold-400/10 blur-2xl" aria-hidden="true" />
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-400/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-gold-400">
          <Crown className="size-3.5" aria-hidden="true" />
          {item.accessLevelName} code
        </span>
        {item.category && <span className="text-xs text-slate-400">{item.category.name}</span>}
      </div>
      <p className="mt-3 line-clamp-2 font-semibold text-white/90">{item.title}</p>
      <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
        <Lock className="size-5 shrink-0 text-gold-400" aria-hidden="true" />
        <span className="code-font select-none text-lg font-semibold text-white/40 blur-[3px]" aria-hidden="true">
          XXXX-XXXX
        </span>
        <span className="sr-only">Code hidden</span>
      </div>
      <p className="mt-3 text-sm text-slate-300">{reason}</p>
      <ButtonLink href="/dashboard/subscription" variant="gold" size="sm" className="mt-4 self-start">
        <Crown className="size-4" aria-hidden="true" /> Upgrade plan
      </ButtonLink>
    </article>
  );
}

function UpcomingCard({ item, timezone }) {
  return (
    <article className="card flex flex-col border-dashed p-5">
      <div className="flex items-center justify-between gap-2">
        <LevelBadge level={item.accessLevel} name={item.accessLevelName} />
        <StatusBadge status="SCHEDULED" />
      </div>
      <p className="mt-3 line-clamp-2 font-semibold text-slate-900">{item.title}</p>
      <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-500">
        <CalendarClock className="size-3.5" aria-hidden="true" />
        <span suppressHydrationWarning>{formatDateTime(item.publishAt, timezone)}</span>
      </p>
      <div className="mt-4 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900 ring-1 ring-sky-100">
        Releases in <Countdown to={item.publishAt} />
      </div>
    </article>
  );
}

export function BetCodeCardSkeleton() {
  return (
    <div className="card p-5">
      <div className="flex justify-between">
        <div className="skeleton h-5 w-20" />
        <div className="skeleton h-5 w-8" />
      </div>
      <div className="skeleton mt-4 h-5 w-3/4" />
      <div className="skeleton mt-2 h-3 w-1/2" />
      <div className="skeleton mt-5 h-14 w-full rounded-xl" />
      <div className="skeleton mt-4 h-3 w-full" />
      <div className="skeleton mt-2 h-3 w-2/3" />
    </div>
  );
}
