"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, Skeleton } from "./Primitives";

/**
 * Responsive table: horizontal scroll on small screens, sortable headers,
 * skeleton rows while loading, empty and error states.
 * columns: [{ key, label, sortable?, className?, render?(row) }]
 */
export function DataTable({ columns, rows, loading, error, onRetry, sort, order, onSort, empty, rowKey = (r) => r.id, onRowClick }) {
  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/70">
            {columns.map((col) => {
              const active = sort === col.key;
              const Icon = !active ? ArrowUpDown : order === "asc" ? ArrowUp : ArrowDown;
              return (
                <th key={col.key} scope="col" className={cn("px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500", col.className)} aria-sort={active ? (order === "asc" ? "ascending" : "descending") : undefined}>
                  {col.sortable && onSort ? (
                    <button type="button" onClick={() => onSort(col.key)} className={cn("inline-flex items-center gap-1 uppercase hover:text-slate-800", active && "text-slate-800")}>
                      {col.label}
                      <Icon className="size-3.5" aria-hidden="true" />
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading && !rows?.length
            ? Array.from({ length: 6 }).map((_, i) => (
                <tr key={`sk-${i}`}>
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3.5">
                      <Skeleton className="h-4 w-full max-w-[160px]" />
                    </td>
                  ))}
                </tr>
              ))
            : rows?.map((row) => (
                <tr
                  key={rowKey(row)}
                  className={cn("transition-colors hover:bg-slate-50/80", onRowClick && "cursor-pointer", loading && "opacity-60")}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn("px-4 py-3 align-middle text-slate-700", col.className)}>
                      {col.render ? col.render(row) : (row[col.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
      {error && !loading && <ErrorState description={error.message} onRetry={onRetry} />}
      {!loading && !error && rows && rows.length === 0 && (empty || <EmptyState title="Nothing here yet" description="Try adjusting your search or filters." />)}
    </div>
  );
}

export function Pagination({ meta, onPage }) {
  if (!meta || meta.pages <= 1) {
    return meta ? <div className="px-4 py-3 text-xs text-slate-500">{meta.total} result{meta.total === 1 ? "" : "s"}</div> : null;
  }
  const { page, pages, total, limit } = meta;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3" aria-label="Pagination">
      <p className="text-xs text-slate-500">
        Showing <span className="font-medium text-slate-700">{from}</span>–<span className="font-medium text-slate-700">{to}</span> of{" "}
        <span className="font-medium text-slate-700">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40" aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </button>
        <span className="px-2 text-xs font-medium text-slate-600 tabular-nums">
          {page} / {pages}
        </span>
        <button type="button" onClick={() => onPage(page + 1)} disabled={page >= pages} className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40" aria-label="Next page">
          <ChevronRight className="size-4" />
        </button>
      </div>
    </nav>
  );
}

export function SearchInput({ value, onChange, placeholder = "Search…", className }) {
  return (
    <div className={cn("relative w-full sm:max-w-xs", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
      />
    </div>
  );
}

export function FilterSelect({ value, onChange, options, label, className }) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || undefined)}
      aria-label={label}
      className={cn(
        "h-10 rounded-lg border border-slate-300 bg-white px-3 pr-8 text-sm text-slate-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15",
        className
      )}
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toolbar({ children }) {
  return <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row sm:flex-wrap sm:items-center">{children}</div>;
}
