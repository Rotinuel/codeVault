"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, CreditCard, Crown, Info, ShieldAlert, Ticket, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/client/hooks";
import { apiFetch, toQuery } from "@/lib/client/api";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/DataTable";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/Primitives";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";

const TYPE_ICON = { PAYMENT: CreditCard, SUBSCRIPTION: Crown, BET_CODE: Ticket, SECURITY: ShieldAlert, SYSTEM: Info };
const FILTERS = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "BET_CODE", label: "Bet codes" },
  { value: "PAYMENT", label: "Payments" },
  { value: "SUBSCRIPTION", label: "Subscription" },
  { value: "SECURITY", label: "Security" },
];

export function NotificationsList() {
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const query = {
    page,
    limit: 20,
    unread: filter === "unread" ? "1" : undefined,
    type: !["all", "unread"].includes(filter) ? filter : undefined,
  };
  const { data, error, loading, reload, setData } = useApi(`/api/notifications${toQuery(query)}`);

  async function markAll() {
    try {
      await apiFetch("/api/notifications/read-all", { method: "POST" });
      toast.success("All caught up");
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function open(n) {
    if (!n.read) {
      await apiFetch(`/api/notifications/${n.id}`, { method: "PATCH", body: { read: true } }).catch(() => {});
      setData((d) => ({ ...d, notifications: d.notifications.map((x) => (x.id === n.id ? { ...x, read: true } : x)), unreadCount: Math.max(0, (d.unreadCount || 1) - 1) }));
    }
    if (n.link) router.push(n.link);
  }

  async function remove(n) {
    try {
      await apiFetch(`/api/notifications/${n.id}`, { method: "DELETE" });
      setData((d) => ({ ...d, notifications: d.notifications.filter((x) => x.id !== n.id) }));
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          tabs={FILTERS}
          value={filter}
          layoutId="notif-tabs"
          onChange={(v) => {
            setFilter(v);
            setPage(1);
          }}
        />
        <Button variant="secondary" size="sm" onClick={markAll} disabled={!data?.unreadCount}>
          <CheckCheck className="size-4" /> Mark all read {data?.unreadCount ? `(${data.unreadCount})` : ""}
        </Button>
      </div>
      {error ? (
        <ErrorState description={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3 p-4">
              <Skeleton className="size-9 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : !data?.notifications?.length ? (
        <EmptyState icon={Bell} title="No notifications" description="Payment receipts, bet code releases and account alerts will show up here." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {data.notifications.map((n) => {
            const I = TYPE_ICON[n.type] || Info;
            return (
              <li key={n.id} className={cn("group flex gap-3 p-4 transition-colors hover:bg-slate-50", !n.read && "bg-brand-50/40")}>
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
                  <I className="size-4" aria-hidden="true" />
                </span>
                <button type="button" onClick={() => open(n)} className="min-w-0 flex-1 text-left">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">{n.title}</span>
                    {!n.read && <span className="size-2 rounded-full bg-brand-500" aria-label="unread" />}
                  </span>
                  <span className="mt-0.5 block text-sm text-slate-600">{n.message}</span>
                  <span className="mt-1 block text-xs text-slate-400" title={formatDateTime(n.createdAt)}>
                    {timeAgo(n.createdAt)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => remove(n)}
                  className="h-8 shrink-0 rounded-lg px-2 text-slate-400 opacity-100 hover:bg-rose-50 hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100"
                  aria-label="Delete notification"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination meta={data?.meta} onPage={setPage} />
    </div>
  );
}
