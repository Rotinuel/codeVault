"use client";

import Link from "next/link";
import { useListQuery, useApi } from "@/lib/client/hooks";
import { DataTable, FilterSelect, Pagination, SearchInput, Toolbar } from "@/components/ui/DataTable";
import { StatusBadge, Badge } from "@/components/ui/Primitives";
import { formatCurrency, formatDate, titleCase } from "@/lib/utils";

export function SubscriptionsTable() {
  const list = useListQuery("/api/admin/subscriptions", { sort: "createdAt" });
  const plans = useApi("/api/admin/plans");
  const { data, params } = list;
  const now = new Date();

  const columns = [
    {
      key: "user",
      label: "Subscriber",
      render: (s) =>
        s.user ? (
          <Link href={`/admin/users/${s.user.id}`} className="block min-w-0 hover:text-brand-700">
            <span className="block truncate font-medium text-slate-900">{s.user.name}</span>
            <span className="block truncate text-xs text-slate-500">{s.user.email}</span>
          </Link>
        ) : (
          "—"
        ),
    },
    { key: "planName", label: "Plan", render: (s) => <span className="font-medium">{s.planName}</span> },
    { key: "accessLevel", label: "Level", sortable: true, render: (s) => <Badge tone="gold">L{s.accessLevel}</Badge> },
    { key: "type", label: "Type", render: (s) => titleCase(s.type) },
    { key: "price", label: "Price", sortable: true, render: (s) => <span className="tabular-nums">{formatCurrency(s.price, s.currency)}</span> },
    { key: "startDate", label: "Start", sortable: true, render: (s) => formatDate(s.startDate) },
    { key: "endDate", label: "Expiry", sortable: true, render: (s) => formatDate(s.endDate) },
    {
      key: "status",
      label: "Status",
      render: (s) => {
        const expired = s.status === "ACTIVE" && new Date(s.endDate) <= now;
        const queued = s.status === "ACTIVE" && new Date(s.startDate) > now;
        return queued ? <Badge tone="blue">Queued</Badge> : <StatusBadge status={expired ? "EXPIRED" : s.status} />;
      },
    },
  ];

  return (
    <>
      {data?.summary && (
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-brand-50 px-3 py-1 font-medium text-brand-800 ring-1 ring-brand-200">{data.summary.live} active now</span>
          <span className="rounded-full bg-violet-50 px-3 py-1 font-medium text-violet-800 ring-1 ring-violet-200">{data.summary.expired} expired</span>
        </div>
      )}
      <div className="card overflow-hidden">
        <Toolbar>
          <SearchInput value={list.search} onChange={list.setSearch} placeholder="Search subscriber name or email…" />
          <FilterSelect
            label="All statuses"
            value={params.status}
            onChange={(v) => list.setFilter("status", v)}
            options={[
              { value: "LIVE", label: "Active now" },
              { value: "EXPIRING", label: "Expiring in 7 days" },
              { value: "EXPIRED", label: "Expired" },
              { value: "CANCELLED", label: "Cancelled" },
              { value: "PENDING", label: "Pending" },
            ]}
          />
          <FilterSelect
            label="All plans"
            value={params.plan}
            onChange={(v) => list.setFilter("plan", v)}
            options={(plans.data?.plans || []).map((p) => ({ value: p.id, label: p.name }))}
          />
          <FilterSelect
            label="All types"
            value={params.type}
            onChange={(v) => list.setFilter("type", v)}
            options={["NEW", "RENEWAL", "UPGRADE", "SWITCH", "DOWNGRADE", "MANUAL"].map((t) => ({ value: t, label: titleCase(t) }))}
          />
        </Toolbar>
        <DataTable columns={columns} rows={data?.subscriptions} loading={list.loading} error={list.error} onRetry={list.reload} sort={params.sort} order={params.order} onSort={list.toggleSort} />
        <Pagination meta={data?.meta} onPage={list.setPage} />
      </div>
    </>
  );
}
