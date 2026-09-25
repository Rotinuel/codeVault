"use client";

import { useState } from "react";
import { ReceiptText } from "lucide-react";
import { useApi } from "@/lib/client/hooks";
import { toQuery } from "@/lib/client/api";
import { DataTable, FilterSelect, Pagination, Toolbar } from "@/components/ui/DataTable";
import { EmptyState, StatusBadge } from "@/components/ui/Primitives";
import { ButtonLink } from "@/components/ui/Button";
import { formatCurrency, formatDateTime, titleCase } from "@/lib/utils";

const STATUS_OPTIONS = ["SUCCESS", "PENDING", "FAILED", "CANCELLED", "ABANDONED"].map((s) => ({ value: s, label: titleCase(s) }));

export function PaymentHistory() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState();
  const { data, error, loading, reload } = useApi(`/api/payments${toQuery({ page, status, limit: 15 })}`);

  const columns = [
    { key: "reference", label: "Reference", render: (r) => <span className="font-mono text-xs text-slate-700">{r.reference}</span> },
    { key: "planName", label: "Plan", render: (r) => <span className="font-medium text-slate-900">{r.planName}</span> },
    { key: "type", label: "Type", render: (r) => <span className="text-slate-600">{titleCase(r.type || "")}</span> },
    {
      key: "amount",
      label: "Amount",
      render: (r) => (
        <span className="tabular-nums">
          {formatCurrency(r.amount, r.currency)}
          {r.discountPercent > 0 && <span className="block text-xs text-amber-700">{r.discountPercent}% ticket discount</span>}
        </span>
      ),
    },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "date", label: "Date", render: (r) => <span className="text-slate-600">{formatDateTime(r.paidAt || r.createdAt)}</span> },
  ];

  return (
    <div className="card overflow-hidden">
      <Toolbar>
        <FilterSelect
          label="All statuses"
          value={status}
          options={STATUS_OPTIONS}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        />
      </Toolbar>
      <DataTable
        columns={columns}
        rows={data?.payments}
        loading={loading}
        error={error}
        onRetry={reload}
        empty={
          <EmptyState
            icon={ReceiptText}
            title="No payments yet"
            description="When you subscribe, your receipts will appear here."
            action={<ButtonLink href="/dashboard/subscription">Choose a plan</ButtonLink>}
          />
        }
      />
      <Pagination meta={data?.meta} onPage={setPage} />
    </div>
  );
}
