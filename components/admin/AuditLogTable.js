"use client";

import { useState } from "react";
import { useListQuery } from "@/lib/client/hooks";
import { DataTable, FilterSelect, Pagination, SearchInput, Toolbar } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Primitives";
import { Modal } from "@/components/ui/Modal";
import { formatDateTime, titleCase } from "@/lib/utils";

function actionTone(action) {
  if (/DELETED|BANNED|REMOVED|CANCELLED|MISMATCH/.test(action)) return "red";
  if (/SUSPENDED|PRICE|ROLE|PERMISSIONS/.test(action)) return "amber";
  if (/CREATED|PUBLISHED|GRANTED|REACTIVATED/.test(action)) return "green";
  return "gray";
}

export function AuditLogTable() {
  const list = useListQuery("/api/admin/audit-logs", { sort: "createdAt", limit: 25 });
  const { data, params } = list;
  const [detail, setDetail] = useState(null);

  const columns = [
    { key: "createdAt", label: "When", sortable: true, render: (l) => <span className="whitespace-nowrap text-slate-600">{formatDateTime(l.createdAt)}</span> },
    {
      key: "user",
      label: "Actor",
      render: (l) => (
        <div>
          <p className="font-medium text-slate-900">{l.user || "System"}</p>
          {l.role && <p className="text-xs text-slate-500">{titleCase(l.role)}</p>}
        </div>
      ),
    },
    { key: "action", label: "Action", sortable: true, render: (l) => <Badge tone={actionTone(l.action)}>{titleCase(l.action)}</Badge> },
    {
      key: "target",
      label: "Target",
      render: (l) => (
        <div className="max-w-[220px]">
          <p className="text-slate-700">{l.targetType || "—"}</p>
          <p className="truncate text-xs text-slate-500">{l.metadata?.title || l.metadata?.email || l.metadata?.name || l.targetId}</p>
        </div>
      ),
    },
    { key: "ipAddress", label: "IP", render: (l) => <span className="font-mono text-xs text-slate-500">{l.ipAddress}</span> },
    {
      key: "details",
      label: <span className="sr-only">Details</span>,
      render: (l) => (
        <button type="button" onClick={() => setDetail(l)} className="text-sm font-medium text-brand-700 hover:text-brand-800">
          Details
        </button>
      ),
    },
  ];

  return (
    <div className="card overflow-hidden">
      <Toolbar>
        <SearchInput value={list.search} onChange={list.setSearch} placeholder="Search actor, action, target, IP…" />
        <FilterSelect label="All actions" value={params.action} onChange={(v) => list.setFilter("action", v)} options={(data?.actions || []).map((a) => ({ value: a, label: titleCase(a) }))} />
        <FilterSelect
          label="All targets"
          value={params.targetType}
          onChange={(v) => list.setFilter("targetType", v)}
          options={["User", "BetCode", "Category", "SubscriptionPlan", "Payment", "Settings", "Broadcast"].map((t) => ({ value: t, label: t }))}
        />
      </Toolbar>
      <DataTable columns={columns} rows={data?.logs} loading={list.loading} error={list.error} onRetry={list.reload} sort={params.sort} order={params.order} onSort={list.toggleSort} />
      <Pagination meta={data?.meta} onPage={list.setPage} />
      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={detail ? titleCase(detail.action) : ""} description={detail ? formatDateTime(detail.createdAt) : ""} size="lg">
        {detail && (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Actor</dt>
              <dd>
                {detail.user || "System"} {detail.role ? `(${titleCase(detail.role)})` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Target</dt>
              <dd className="font-mono text-xs">
                {detail.targetType} · {detail.targetId}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Client</dt>
              <dd className="break-all text-xs text-slate-600">
                {detail.ipAddress} — {detail.userAgent}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Metadata</dt>
              <dd>
                <pre className="scrollbar-thin mt-1 max-h-80 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(detail.metadata, null, 2)}</pre>
              </dd>
            </div>
          </dl>
        )}
      </Modal>
    </div>
  );
}
