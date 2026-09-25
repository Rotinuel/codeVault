"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useListQuery, useApi } from "@/lib/client/hooks";
import { apiFetch } from "@/lib/client/api";
import { Button } from "@/components/ui/Button";
import { DataTable, FilterSelect, Pagination, SearchInput, Toolbar } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/Primitives";
import { formatCurrency, formatDateTime, titleCase } from "@/lib/utils";

export function PaymentsTable() {
  const list = useListQuery("/api/admin/payments", { sort: "createdAt" });
  const plans = useApi("/api/admin/plans");
  const { data, params } = list;
  const [checking, setChecking] = useState(null);

  async function recheck(p) {
    setChecking(p.id);
    try {
      const res = await apiFetch(`/api/admin/payments/${p.id}/verify`, { method: "POST" });
      if (res.status === "SUCCESS") toast.success(`${p.reference}: payment confirmed, subscription active`);
      else toast.message(`${p.reference}: still ${String(res.status).toLowerCase()}`, { description: res.payment?.failureReason || undefined });
      list.reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setChecking(null);
    }
  }

  const columns = [
    { key: "reference", label: "Reference", render: (p) => <span className="font-mono text-xs">{p.reference}</span> },
    {
      key: "user",
      label: "Customer",
      render: (p) =>
        p.user ? (
          <Link href={`/admin/users/${p.user.id}`} className="block hover:text-brand-700">
            <span className="block font-medium text-slate-900">{p.user.name}</span>
            <span className="block text-xs text-slate-500">{p.user.email}</span>
          </Link>
        ) : (
          "—"
        ),
    },
    { key: "planName", label: "Plan" },
    { key: "type", label: "Type", render: (p) => titleCase(p.type || "") },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      render: (p) => (
        <span className="tabular-nums font-medium">
          {formatCurrency(p.amount, p.currency)}
          {p.discountPercent > 0 && (
            <span className="block text-xs font-normal text-amber-700" title={`List price ${formatCurrency(p.originalAmount, p.currency)}`}>
              −{p.discountPercent}% ticket reward
            </span>
          )}
        </span>
      ),
    },
    { key: "paymentMethod", label: "Method", render: (p) => (p.paymentMethod ? titleCase(p.paymentMethod) : p.gateway === "free" ? "Free" : "—") },
    {
      key: "status",
      label: "Status",
      render: (p) => (
        <div className="max-w-[16rem]">
          <StatusBadge status={p.status} />
          {p.failureReason && p.status !== "SUCCESS" ? (
            <p className="mt-1 text-xs leading-snug text-rose-600" title={p.failureReason}>
              {p.failureReason}
            </p>
          ) : null}
          {p.gateway === "paystack" && ["FAILED", "PENDING", "ABANDONED", "CANCELLED"].includes(p.status) ? (
            <Button size="xs" variant="secondary" className="mt-2 whitespace-nowrap" loading={checking === p.id} onClick={() => recheck(p)}>
              Re-check with Paystack
            </Button>
          ) : null}
        </div>
      ),
    },
    { key: "createdAt", label: "Date", sortable: true, render: (p) => <span className="whitespace-nowrap text-slate-600">{formatDateTime(p.paidAt || p.createdAt)}</span> },
  ];

  return (
    <>
      {data?.totals?.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          {data.totals.map((t) => (
            <span key={t.currency} className="rounded-full bg-brand-50 px-3 py-1 font-medium text-brand-800 ring-1 ring-brand-200">
              {formatCurrency(t.revenue, t.currency)} from {t.count} successful payment{t.count === 1 ? "" : "s"} (filtered)
            </span>
          ))}
        </div>
      )}
      <div className="card overflow-hidden">
        <Toolbar>
          <SearchInput value={list.search} onChange={list.setSearch} placeholder="Reference, name or email…" />
          <FilterSelect
            label="All statuses"
            value={params.status}
            onChange={(v) => list.setFilter("status", v)}
            options={["SUCCESS", "PENDING", "PROCESSING", "FAILED", "CANCELLED", "ABANDONED"].map((s) => ({ value: s, label: titleCase(s) }))}
          />
          <FilterSelect label="All plans" value={params.plan} onChange={(v) => list.setFilter("plan", v)} options={(plans.data?.plans || []).map((p) => ({ value: p.id, label: p.name }))} />
          <label className="flex items-center gap-2 text-sm text-slate-500">
            From
            <input type="date" value={params.from || ""} onChange={(e) => list.setFilter("from", e.target.value || undefined)} className="h-10 rounded-lg border border-slate-300 px-2 text-sm" />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-500">
            To
            <input type="date" value={params.to || ""} onChange={(e) => list.setFilter("to", e.target.value || undefined)} className="h-10 rounded-lg border border-slate-300 px-2 text-sm" />
          </label>
        </Toolbar>
        <DataTable columns={columns} rows={data?.payments} loading={list.loading} error={list.error} onRetry={list.reload} sort={params.sort} order={params.order} onSort={list.toggleSort} />
        <Pagination meta={data?.meta} onPage={list.setPage} />
      </div>
    </>
  );
}
