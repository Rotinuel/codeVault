"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/client/hooks";
import { apiFetch } from "@/lib/client/api";
import { Badge, Card, CardHeader, EmptyState, ErrorState, Skeleton, StatusBadge } from "@/components/ui/Primitives";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Modal";
import { formatCurrency, formatDate } from "@/lib/utils";
import { RewardProgress } from "./RewardProgress";
import { TicketUploadForm } from "./TicketUploadForm";

function TicketRow({ t, onWithdraw }) {
  const multiple = t.stake > 0 ? Math.round((t.payout / t.stake) * 10) / 10 : null;
  return (
    <li className="flex gap-4 p-4">
      <a href={t.imageUrl} target="_blank" rel="noreferrer" className="shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={t.imageUrl} alt={`${t.bookmaker} ticket ${t.ticketRef}`} className="h-24 w-20 rounded-lg border border-slate-200 object-cover" loading="lazy" />
      </a>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-slate-900">{formatCurrency(t.payout, t.currency)}</p>
          <StatusBadge status={t.status} />
          {t.redeemedAt && <Badge tone="violet">Earned a discount</Badge>}
          {t.showcase && <Badge tone="gold" icon={Trophy}>On homepage</Badge>}
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {t.bookmaker} · <span className="font-mono text-xs">{t.ticketRef}</span> · stake {formatCurrency(t.stake, t.currency)}
          {multiple ? ` · ${multiple}×` : ""}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          Won {formatDate(t.wonAt)} · submitted {formatDate(t.createdAt)}
          {t.reviewedAt ? ` · reviewed ${formatDate(t.reviewedAt)}` : ""}
        </p>
        {t.status === "REJECTED" && t.rejectionReason && <p className="mt-1.5 text-sm text-rose-600">Reason: {t.rejectionReason}</p>}
      </div>
      {t.status === "PENDING" && (
        <Button size="xs" variant="ghost" className="self-start" onClick={() => onWithdraw(t)}>
          Withdraw
        </Button>
      )}
    </li>
  );
}

export function WinningTicketsCenter() {
  const { data, error, loading, reload } = useApi("/api/winning-tickets");
  const [withdraw, setWithdraw] = useState(null);
  const [busy, setBusy] = useState(false);

  async function confirmWithdraw() {
    setBusy(true);
    try {
      await apiFetch(`/api/winning-tickets/${withdraw.id}`, { method: "DELETE" });
      toast.success("Ticket withdrawn");
      setWithdraw(null);
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <Card><ErrorState description={error.message} onRetry={reload} /></Card>;

  return (
    <div className="space-y-6">
      {loading && !data ? <Skeleton className="h-56 w-full rounded-2xl" /> : <RewardProgress reward={data?.reward} />}

      <TicketUploadForm onUploaded={reload} />

      <Card>
        <CardHeader title="Your tickets" description="Approved tickets count towards the target for the month you uploaded them." />
        {loading && !data ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : data?.tickets?.length ? (
          <ul className="divide-y divide-slate-100">
            {data.tickets.map((t) => (
              <TicketRow key={t.id} t={t} onWithdraw={setWithdraw} />
            ))}
          </ul>
        ) : (
          <EmptyState icon={Trophy} title="No tickets yet" description="Won with a CodeVault code? Upload the ticket above to work towards this month's discount target." />
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(withdraw)}
        onClose={() => setWithdraw(null)}
        onConfirm={confirmWithdraw}
        loading={busy}
        title="Withdraw this ticket?"
        description="It will be removed before review. You can upload it again later."
        confirmLabel="Withdraw"
      />
    </div>
  );
}
