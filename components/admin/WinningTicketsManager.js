"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Trophy } from "lucide-react";
import { toast } from "sonner";
import { useApi, useListQuery } from "@/lib/client/hooks";
import { apiFetch } from "@/lib/client/api";
import { Badge, Card, CardHeader, EmptyState, ErrorState, Skeleton, StatusBadge } from "@/components/ui/Primitives";
import { Button } from "@/components/ui/Button";
import { Field, Input, Switch, Textarea } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { Tabs } from "@/components/ui/Tabs";
import { Pagination, SearchInput, Toolbar } from "@/components/ui/DataTable";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

const REJECT_REASONS = [
  "Image is unclear or cropped",
  "Ticket ID / status not visible",
  "Ticket appears edited",
  "Could not verify with the bookmaker",
  "Duplicate submission",
];

// ── Review queue ────────────────────────────────────────────────

function TicketCard({ t, onOpen }) {
  const multiple = t.stake > 0 ? Math.round((t.payout / t.stake) * 10) / 10 : null;
  return (
    <button type="button" onClick={() => onOpen(t)} className="card group overflow-hidden text-left transition-shadow hover:shadow-md focus-visible:ring-4 focus-visible:ring-brand-500/20">
      <div className="relative aspect-[4/3] bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={t.imageUrl} alt="" className="size-full object-cover transition-transform group-hover:scale-[1.02]" loading="lazy" />
        <div className="absolute left-2 top-2 flex gap-1.5">
          <StatusBadge status={t.status} />
          {t.showcase && <Badge tone="gold" icon={Trophy}>Homepage</Badge>}
        </div>
      </div>
      <div className="p-4">
        <p className="text-lg font-semibold text-slate-900">{formatCurrency(t.payout, t.currency)}</p>
        <p className="text-sm text-slate-600">
          {t.bookmaker} · stake {formatCurrency(t.stake, t.currency)}
          {multiple ? ` · ${multiple}×` : ""}
        </p>
        <p className="mt-2 truncate text-sm font-medium text-slate-800">{t.user?.name || "Unknown client"}</p>
        <p className="truncate text-xs text-slate-500">{t.user?.email}</p>
        <p className="mt-2 text-xs text-slate-400">Submitted {formatDateTime(t.createdAt)}</p>
      </div>
    </button>
  );
}

function ReviewModal({ ticket, onClose, onDone }) {
  const [mode, setMode] = useState("view");
  const [showcase, setShowcase] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMode("view");
    setShowcase(Boolean(ticket?.showcaseConsent));
    setReason("");
  }, [ticket]);

  if (!ticket) return null;
  const t = ticket;
  const stats = t.uploaderStats;

  async function act(body) {
    setBusy(true);
    try {
      const res = await apiFetch(`/api/admin/winning-tickets/${t.id}`, { method: "PATCH", body });
      toast.success(body.action === "approve" ? "Ticket approved" : body.action === "reject" ? "Ticket rejected" : "Homepage visibility updated");
      onDone(res.ticket);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  const footer =
    mode === "reject" ? (
      <>
        <Button variant="secondary" onClick={() => setMode("view")} disabled={busy}>Back</Button>
        <Button variant="danger" loading={busy} disabled={reason.trim().length < 3} onClick={() => act({ action: "reject", reason })}>
          Reject ticket
        </Button>
      </>
    ) : t.status === "PENDING" ? (
      <>
        <Button variant="secondary" onClick={() => setMode("reject")} disabled={busy}>Reject…</Button>
        <Button loading={busy} onClick={() => act({ action: "approve", showcase })}>Approve ticket</Button>
      </>
    ) : t.status === "APPROVED" ? (
      <>
        {!t.redeemedAt && <Button variant="secondary" onClick={() => setMode("reject")} disabled={busy}>Revoke approval…</Button>}
        {t.showcaseConsent && (
          <Button variant={t.showcase ? "secondary" : "primary"} loading={busy} onClick={() => act({ action: "showcase", showcase: !t.showcase })}>
            {t.showcase ? "Remove from homepage" : "Show on homepage"}
          </Button>
        )}
      </>
    ) : (
      <Button onClick={() => act({ action: "approve", showcase })} loading={busy}>Approve after all</Button>
    );

  return (
    <Modal open={Boolean(ticket)} onClose={busy ? undefined : onClose} size="xl" title="Review winning ticket" description={`${t.bookmaker} · ${t.ticketRef}`} footer={footer}>
      <div className="grid gap-6 md:grid-cols-[1.1fr_1fr]">
        <a href={t.imageUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-slate-200 bg-slate-50" title="Open full size">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={t.imageUrl} alt={`Ticket ${t.ticketRef}`} className="max-h-[70vh] w-full object-contain" />
          <span className="flex items-center justify-center gap-1 py-2 text-xs text-slate-500">
            <ExternalLink className="size-3" aria-hidden="true" /> Open full size
          </span>
        </a>

        <div className="space-y-5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={t.status} />
            {t.redeemedAt && <Badge tone="violet">Used for a discount</Badge>}
            {t.showcase && <Badge tone="gold" icon={Trophy}>On homepage</Badge>}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div><dt className="text-xs text-slate-500">Amount won</dt><dd className="font-semibold text-slate-900">{formatCurrency(t.payout, t.currency)}</dd></div>
            <div><dt className="text-xs text-slate-500">Stake</dt><dd className="font-semibold text-slate-900">{formatCurrency(t.stake, t.currency)}</dd></div>
            <div><dt className="text-xs text-slate-500">Bookmaker</dt><dd className="text-slate-900">{t.bookmaker}</dd></div>
            <div><dt className="text-xs text-slate-500">Ticket ID</dt><dd className="font-mono text-xs text-slate-900">{t.ticketRef}</dd></div>
            <div><dt className="text-xs text-slate-500">Date won</dt><dd className="text-slate-900">{formatDate(t.wonAt)}</dd></div>
            <div><dt className="text-xs text-slate-500">Code used</dt><dd className="text-slate-900">{t.codeUsed || "—"}</dd></div>
          </dl>
          {t.note && <p className="rounded-lg bg-slate-50 p-3 text-slate-700">&ldquo;{t.note}&rdquo;</p>}

          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Uploaded by (never shown publicly)</p>
            {t.user?.name ? (
              <Link href={`/admin/users/${t.user.id}`} className="mt-1 block font-medium text-slate-900 hover:text-brand-700">{t.user.name}</Link>
            ) : null}
            <p className="text-slate-600">{t.user?.email}{t.user?.phone ? ` · ${t.user.phone}` : ""}</p>
            {stats && (
              <p className="mt-1 text-xs text-slate-500">
                Tickets from this client: {stats.APPROVED} approved · {stats.PENDING} pending · {stats.REJECTED} rejected
              </p>
            )}
            <p className="mt-1 text-xs text-slate-400">Submitted {formatDateTime(t.createdAt)}{t.ipAddress ? ` from ${t.ipAddress}` : ""}</p>
          </div>

          {t.status === "REJECTED" && t.rejectionReason && <p className="text-rose-600">Rejected: {t.rejectionReason}</p>}
          {t.reviewedBy && <p className="text-xs text-slate-500">Reviewed by {t.reviewedBy} on {formatDateTime(t.reviewedAt)}</p>}

          {mode === "reject" ? (
            <div className="space-y-2">
              <Field label="Reason (sent to the client)" htmlFor="reject-reason">
                <Textarea id="reject-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} data-autofocus />
              </Field>
              <div className="flex flex-wrap gap-1.5">
                {REJECT_REASONS.map((r) => (
                  <button key={r} type="button" onClick={() => setReason(r)} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-200">
                    {r}
                  </button>
                ))}
              </div>
            </div>
          ) : t.status !== "APPROVED" ? (
            <div className="space-y-3 rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Before approving</p>
              <ul className="list-disc space-y-1 pl-4 text-xs text-slate-600">
                <li>Check the ticket ID with {t.bookmaker} (the &ldquo;check ticket&rdquo; / booking lookup).</li>
                <li>Stake, winnings and date on the slip match what the client entered.</li>
                <li>Look for edits: mismatched fonts, blurred totals, odd spacing.</li>
              </ul>
              <Switch
                id="approve-showcase"
                checked={showcase && t.showcaseConsent}
                disabled={!t.showcaseConsent}
                onChange={setShowcase}
                label="Show on homepage carousel"
                description={
                  t.showcaseConsent
                    ? "Only if the image doesn't show the client's name, phone or account number."
                    : "The client didn't agree to public display."
                }
              />
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

function ReviewQueue() {
  const list = useListQuery("/api/admin/winning-tickets", { status: "PENDING", limit: 12 });
  const { data, params } = list;
  const [open, setOpen] = useState(null);
  const counts = data?.counts || {};

  const tabs = [
    { value: "PENDING", label: `Pending${counts.PENDING ? ` (${counts.PENDING})` : ""}` },
    { value: "APPROVED", label: `Approved${counts.APPROVED ? ` (${counts.APPROVED})` : ""}` },
    { value: "REJECTED", label: `Rejected${counts.REJECTED ? ` (${counts.REJECTED})` : ""}` },
    { value: "SHOWCASE", label: "On homepage" },
    { value: "ALL", label: "All" },
  ];
  const tabValue = params.showcase ? "SHOWCASE" : params.status || "ALL";

  function onTab(v) {
    if (v === "SHOWCASE") {
      list.setFilter("status", "APPROVED");
      list.setFilter("showcase", "1");
    } else {
      list.setFilter("showcase", undefined);
      list.setFilter("status", v === "ALL" ? undefined : v);
    }
  }

  return (
    <>
      <div className="card overflow-hidden">
        <Toolbar>
          <Tabs tabs={tabs} value={tabValue} onChange={onTab} layoutId="ticket-tabs" />
          <SearchInput value={list.search} onChange={list.setSearch} placeholder="Client, email, ticket ID…" />
        </Toolbar>
        <div className="p-4">
          {list.error ? (
            <ErrorState description={list.error.message} onRetry={list.reload} />
          ) : list.loading && !data ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-80 w-full rounded-2xl" />)}
            </div>
          ) : data?.tickets?.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {data.tickets.map((t) => <TicketCard key={t.id} t={t} onOpen={setOpen} />)}
            </div>
          ) : (
            <EmptyState icon={Trophy} title={tabValue === "PENDING" ? "Nothing to review" : "No tickets here"} description="Tickets clients upload from their dashboard appear here." />
          )}
        </div>
        <Pagination meta={data?.meta} onPage={list.setPage} />
      </div>
      <ReviewModal
        ticket={open}
        onClose={() => setOpen(null)}
        onDone={() => {
          setOpen(null);
          list.reload();
        }}
      />
    </>
  );
}

// ── Monthly reward settings (Super Admin) ─────────────────────

function RewardSettings() {
  const { data, error, reload } = useApi("/api/admin/winning-tickets/rewards");
  const [r, setR] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (data?.rewards) setR({ ...data.rewards });
  }, [data]);

  if (error) return <Card><ErrorState description={error.message} onRetry={reload} /></Card>;
  if (!r) return <Skeleton className="h-96 w-full rounded-2xl" />;

  async function save() {
    setSaving(true);
    setErrors({});
    try {
      const res = await apiFetch("/api/admin/winning-tickets/rewards", {
        method: "PATCH",
        body: {
          enabled: r.enabled,
          showcaseEnabled: r.showcaseEnabled,
          monthlyTarget: Number(r.monthlyTarget),
          percent: Number(r.percent),
        },
      });
      setR({ ...res.rewards });
      toast.success("Reward settings saved");
    } catch (e) {
      setErrors(e.errors || {});
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  const target = Number(r.monthlyTarget) || 0;
  const pct = Number(r.percent) || 0;

  return (
    <Card>
      <CardHeader
        title="Monthly reward"
        description="Clients see this on their dashboard. A client whose approved uploads in a calendar month reach the target gets the discount on one subscription payment the following month."
      />
      <div className="space-y-6 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Switch id="rw-enabled" checked={r.enabled} onChange={(v) => setR({ ...r, enabled: v })} label="Discounts for winning tickets" description="Turn off to stop applying discounts (uploads and reviews still work)." />
          <Switch id="rw-showcase" checked={r.showcaseEnabled} onChange={(v) => setR({ ...r, showcaseEnabled: v })} label="Homepage winners carousel" description="Shows approved tickets you've marked for the homepage." />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Approved uploads needed per month" htmlFor="rw-target" required error={errors.monthlyTarget} hint="Counted by upload date, in the platform timezone.">
            <Input id="rw-target" type="number" min="1" max="100" value={r.monthlyTarget} onChange={(e) => setR({ ...r, monthlyTarget: e.target.value })} error={errors.monthlyTarget} />
          </Field>
          <Field label="Discount (%)" htmlFor="rw-percent" required error={errors.percent} hint="1–90%. Applied to one payment the next month.">
            <Input id="rw-percent" type="number" min="1" max="90" value={r.percent} onChange={(e) => setR({ ...r, percent: e.target.value })} error={errors.percent} />
          </Field>
        </div>

        {target > 0 && pct > 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
            <p className="font-medium text-slate-800">What clients will see</p>
            <p className="mt-1">
              Get <strong>{target} winning ticket{target === 1 ? "" : "s"}</strong> approved in a month and get <strong>{pct}% off</strong> one subscription payment the following month.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Example: a client with {target} approved uploads in September gets {pct}% off their first subscription payment in October. Uploads don&apos;t carry over. Each month starts from zero.
            </p>
          </div>
        )}

        <div className="flex justify-end border-t border-slate-100 pt-4">
          <Button onClick={save} loading={saving}>Save reward settings</Button>
        </div>
      </div>
    </Card>
  );
}

export function WinningTicketsManager() {
  const [tab, setTab] = useState("queue");
  return (
    <div className="space-y-6">
      <Tabs
        tabs={[
          { value: "queue", label: "Review tickets" },
          { value: "rewards", label: "Monthly reward & homepage" },
        ]}
        value={tab}
        onChange={setTab}
        layoutId="wt-main-tabs"
      />
      {tab === "queue" ? <ReviewQueue /> : <RewardSettings />}
    </div>
  );
}
