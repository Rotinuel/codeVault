"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Archive, ArchiveRestore, CalendarClock, EyeOff, Pencil, Plus, Rocket, Sparkles, Trash2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { useApi, useListQuery } from "@/lib/client/hooks";
import { apiFetch } from "@/lib/client/api";
import { DataTable, FilterSelect, Pagination, SearchInput, Toolbar } from "@/components/ui/DataTable";
import { Badge, StatusBadge } from "@/components/ui/Primitives";
import { Button } from "@/components/ui/Button";
import { Menu, MenuDivider, MenuItem } from "@/components/ui/Menu";
import { ConfirmDialog } from "@/components/ui/Modal";
import { BatchReleaseModal, BetCodeForm, levelOptions } from "./BetCodeForm";
import { cn, formatDateTime, titleCase } from "@/lib/utils";

const STATUS_FILTERS = [
  { value: "LIVE", label: "Live now" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "PUBLISHED", label: "Published" },
  { value: "DRAFT", label: "Draft" },
  { value: "EXPIRED", label: "Expired" },
  { value: "ARCHIVED", label: "Archived" },
];

export function BetCodeManager({ permissions, timezone, notifyDefault }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const can = (p) => permissions.includes(p);
  const canCreate = can("betcodes.create");
  const canEdit = can("betcodes.edit");
  const canPublish = can("betcodes.publish");
  const canDelete = can("betcodes.delete");

  const list = useListQuery("/api/admin/betcodes", { sort: "publishAt" });
  const { data, params } = list;
  const plans = useApi("/api/admin/plans");
  const cats = useApi("/api/admin/categories");
  const planList = plans.data?.plans || [];
  const categories = cats.data?.categories || [];

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  // Deep links from the overview page: /admin/betcodes?new=1 or ?batch=1
  useEffect(() => {
    if (!plans.data) return;
    if (searchParams.get("new") === "1" && canCreate) setFormOpen(true);
    if (searchParams.get("batch") === "1" && canPublish) setBatchOpen(true);
    if (searchParams.get("new") || searchParams.get("batch")) router.replace("/admin/betcodes");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans.data]);

  async function action(row, act, extra = {}) {
    try {
      const res = await apiFetch(`/api/admin/betcodes/${row.id}/action`, { method: "POST", body: { action: act, ...extra } });
      toast.success(
        {
          publish: "Published — entitled subscribers are being notified",
          unpublish: "Moved to drafts",
          archive: "Archived",
          restore: "Restored to drafts",
          feature: "Featured",
          unfeature: "Unfeatured",
          setResult: "Result saved",
        }[act]
      );
      list.setData((d) => d && { ...d, betCodes: d.betCodes.map((b) => (b.id === row.id ? res.betCode : b)) });
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function confirmDelete() {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/betcodes/${deleting.id}`, { method: "DELETE" });
      toast.success("Bet code deleted");
      setDeleting(null);
      list.reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  const columns = [
    {
      key: "title",
      label: "Title",
      sortable: true,
      render: (b) => (
        <div className="max-w-[220px]">
          <p className="truncate font-medium text-slate-900" title={b.title}>
            {b.isFeatured && <Sparkles className="mr-1 inline size-3.5 text-brand-600" aria-label="Featured" />}
            {b.title}
          </p>
          {b.bookmaker && <p className="truncate text-xs text-slate-500">{b.bookmaker}</p>}
        </div>
      ),
    },
    { key: "code", label: "Code", render: (b) => <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-800">{b.code}</span> },
    {
      key: "category",
      label: "Category",
      render: (b) =>
        b.category ? (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="size-2 rounded-full" style={{ backgroundColor: b.category.color }} aria-hidden="true" />
            {b.category.name}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: "accessLevel",
      label: "Access level",
      sortable: true,
      render: (b) => <Badge tone={b.accessLevel >= 3 ? "gold" : b.accessLevel === 0 ? "gray" : "blue"}>{b.accessLevel === 0 ? "Free" : `L${b.accessLevel} · ${b.accessLevelName}`}</Badge>,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (b) => (
        <div className="flex flex-col items-start gap-1">
          <StatusBadge status={b.effectiveStatus} />
          {b.result !== "PENDING" && <span className={cn("text-[11px] font-semibold", b.result === "WON" ? "text-emerald-700" : b.result === "LOST" ? "text-rose-600" : "text-slate-500")}>{b.result}</span>}
        </div>
      ),
    },
    { key: "publishAt", label: "Publish time", sortable: true, render: (b) => <span className="whitespace-nowrap text-slate-600">{b.publishAt ? formatDateTime(b.publishAt, timezone) : "—"}</span> },
    { key: "expiresAt", label: "Expiry", sortable: true, render: (b) => <span className="whitespace-nowrap text-slate-600">{b.expiresAt ? formatDateTime(b.expiresAt, timezone) : "Never"}</span> },
    { key: "createdBy", label: "Created by", render: (b) => <span className="whitespace-nowrap text-slate-600">{b.createdBy?.name ?? "—"}</span> },
    {
      key: "actions",
      label: <span className="sr-only">Actions</span>,
      className: "w-12 text-right",
      render: (b) => (
        <Menu>
          {canEdit && (
            <MenuItem
              icon={Pencil}
              onClick={() => {
                setEditing(b);
                setFormOpen(true);
              }}
            >
              Edit
            </MenuItem>
          )}
          {canPublish && ["DRAFT", "SCHEDULED"].includes(b.effectiveStatus) && (
            <MenuItem icon={Rocket} onClick={() => action(b, "publish")}>
              Publish now
            </MenuItem>
          )}
          {canPublish && ["PUBLISHED", "SCHEDULED", "EXPIRED"].includes(b.effectiveStatus) && (
            <MenuItem icon={EyeOff} onClick={() => action(b, "unpublish")}>
              Unpublish
            </MenuItem>
          )}
          {canPublish && b.status !== "ARCHIVED" && (
            <MenuItem icon={Archive} onClick={() => action(b, "archive")}>
              Archive
            </MenuItem>
          )}
          {canPublish && b.status === "ARCHIVED" && (
            <MenuItem icon={ArchiveRestore} onClick={() => action(b, "restore")}>
              Restore
            </MenuItem>
          )}
          {canEdit && (
            <>
              <MenuItem icon={Sparkles} onClick={() => action(b, b.isFeatured ? "unfeature" : "feature")}>
                {b.isFeatured ? "Unfeature" : "Feature"}
              </MenuItem>
              <MenuDivider />
              {["WON", "LOST", "VOID", "PENDING"]
                .filter((r) => r !== b.result)
                .map((r) => (
                  <MenuItem key={r} icon={Trophy} onClick={() => action(b, "setResult", { result: r })}>
                    Mark as {titleCase(r)}
                  </MenuItem>
                ))}
            </>
          )}
          {canDelete && (
            <>
              <MenuDivider />
              <MenuItem icon={Trash2} tone="danger" onClick={() => setDeleting(b)}>
                Delete
              </MenuItem>
            </>
          )}
        </Menu>
      ),
    },
  ];

  const counts = data?.counts || {};

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2 text-xs">
          {["PUBLISHED", "SCHEDULED", "DRAFT", "EXPIRED", "ARCHIVED"].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => list.setFilter("status", params.status === s ? undefined : s)}
              className={cn(
                "rounded-full px-3 py-1 font-medium ring-1 ring-inset transition-colors",
                params.status === s ? "bg-ink-900 text-white ring-ink-900" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
              )}
            >
              {titleCase(s)} <span className="tabular-nums opacity-70">{counts[s] || 0}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {canPublish && canCreate && (
            <Button variant="secondary" onClick={() => setBatchOpen(true)} disabled={!plans.data}>
              <CalendarClock className="size-4" /> Schedule a day
            </Button>
          )}
          {canCreate && (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              disabled={!plans.data}
            >
              <Plus className="size-4" /> New bet code
            </Button>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <Toolbar>
          <SearchInput value={list.search} onChange={list.setSearch} placeholder="Search title, code, bookmaker…" />
          <FilterSelect label="All statuses" value={params.status} onChange={(v) => list.setFilter("status", v)} options={STATUS_FILTERS} />
          <FilterSelect label="All categories" value={params.category} onChange={(v) => list.setFilter("category", v)} options={categories.map((c) => ({ value: c.id, label: c.name }))} />
          <FilterSelect
            label="All levels"
            value={params.accessLevel}
            onChange={(v) => list.setFilter("accessLevel", v)}
            options={levelOptions(planList).map((l) => ({ value: String(l.value), label: l.label }))}
          />
        </Toolbar>
        <DataTable
          columns={columns}
          rows={data?.betCodes}
          loading={list.loading}
          error={list.error}
          onRetry={list.reload}
          sort={params.sort}
          order={params.order}
          onSort={list.toggleSort}
        />
        <Pagination meta={data?.meta} onPage={list.setPage} />
      </div>

      <BetCodeForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSaved={list.reload}
        initial={editing}
        categories={categories}
        plans={planList}
        defaultTimezone={timezone}
        canPublish={canPublish}
        notifyDefault={notifyDefault}
      />
      <BatchReleaseModal open={batchOpen} onClose={() => setBatchOpen(false)} onSaved={list.reload} categories={categories.filter((c) => c.isActive)} plans={planList} defaultTimezone={timezone} notifyDefault={notifyDefault} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={busy}
        title="Delete this bet code?"
        confirmLabel="Delete permanently"
        description={
          <>
            <strong>{deleting?.title}</strong> will be removed for all subscribers, along with favourites and view records. Consider archiving instead to keep history.
          </>
        }
      />
    </>
  );
}
