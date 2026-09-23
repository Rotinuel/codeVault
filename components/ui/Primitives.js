import { CircleAlert, Inbox, LoaderCircle } from "lucide-react";
import { cn, initials } from "@/lib/utils";

const BADGE_TONES = {
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-rose-50 text-rose-700 ring-rose-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  gold: "bg-linear-to-r from-amber-100 to-yellow-100 text-amber-900 ring-amber-300",
  dark: "bg-ink-900 text-white ring-ink-800",
};

export function Badge({ tone = "gray", className, children, icon: Icon }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap", BADGE_TONES[tone], className)}>
      {Icon && <Icon className="size-3" aria-hidden="true" />}
      {children}
    </span>
  );
}

const STATUS_TONES = {
  ACTIVE: "green",
  PUBLISHED: "green",
  SUCCESS: "green",
  WON: "green",
  SENT: "green",
  SCHEDULED: "blue",
  PENDING: "amber",
  PROCESSING: "amber",
  QUEUED: "amber",
  DRAFT: "gray",
  ARCHIVED: "gray",
  VOID: "gray",
  SKIPPED: "gray",
  EXPIRED: "violet",
  CANCELLED: "gray",
  ABANDONED: "gray",
  SUSPENDED: "amber",
  FAILED: "red",
  LOST: "red",
  BANNED: "red",
};

export function StatusBadge({ status, className }) {
  if (!status) return null;
  const label = String(status).replace(/_/g, " ").toLowerCase();
  return (
    <Badge tone={STATUS_TONES[status] || "gray"} className={cn("capitalize", className)}>
      <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
      {label}
    </Badge>
  );
}

export function Card({ className, children, ...props }) {
  return (
    <div className={cn("card", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, description, action, className }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4", className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-700">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.7rem]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={cn("skeleton h-4", className)} aria-hidden="true" />;
}

export function Spinner({ className, label = "Loading" }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-slate-500">
      <LoaderCircle className={cn("size-4 animate-spin", className)} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, className }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-500">
        <Icon className="size-6" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", description, onRetry, className }) {
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-rose-50 text-rose-600">
        <CircleAlert className="size-6" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-5 text-sm font-medium text-brand-700 hover:text-brand-800">
          Try again
        </button>
      )}
    </div>
  );
}

export function Avatar({ name, className }) {
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full bg-linear-to-br from-brand-500 to-brand-700 text-xs font-semibold text-white ring-2 ring-white",
        className
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function StatCard({ label, value, hint, icon: Icon, tone = "brand", className }) {
  const tones = {
    brand: "bg-brand-50 text-brand-700",
    blue: "bg-sky-50 text-sky-700",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
    rose: "bg-rose-50 text-rose-700",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <div className={cn("card p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {Icon && (
          <span className={cn("grid size-9 place-items-center rounded-xl", tones[tone])}>
            <Icon className="size-[18px]" aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="card p-5">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-4 h-7 w-20" />
      <Skeleton className="mt-2 h-3 w-32" />
    </div>
  );
}
