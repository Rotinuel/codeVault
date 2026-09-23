"use client";

import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, Crown, Eye, RefreshCw, Ticket, TrendingUp, UserCheck, UserMinus, Users, Wallet } from "lucide-react";
import { useApi } from "@/lib/client/hooks";
import { Card, CardHeader, EmptyState, ErrorState, StatCard, StatCardSkeleton, Skeleton } from "@/components/ui/Primitives";
import { Tabs } from "@/components/ui/Tabs";
import { formatCurrency, formatNumber } from "@/lib/utils";

// Validated categorical slots (see globals.css --color-series-*).
const SERIES_1 = "#2a78d6";
const SERIES_3 = "#1baf7a";
const GRID = "#e2e8f0";
const AXIS = "#64748b";

function shortDate(iso) {
  const [, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}`;
}

function ChartTooltip({ active, payload, label, format }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-slate-500">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-slate-900">
          <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} aria-hidden="true" />
          <span className="font-semibold tabular-nums">{format ? format(p.value) : formatNumber(p.value)}</span>
          <span className="text-slate-500">{p.name}</span>
        </p>
      ))}
    </div>
  );
}

function DataTableToggle({ rows, columns }) {
  return (
    <details className="border-t border-slate-100 px-5 py-3 text-sm">
      <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">View as table</summary>
      <div className="scrollbar-thin mt-3 max-h-64 overflow-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-slate-500">
              {columns.map((c) => (
                <th key={c.key} className="py-1 pr-4 font-semibold">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-slate-100">
                {columns.map((c) => (
                  <td key={c.key} className="py-1 pr-4 tabular-nums text-slate-700">
                    {c.format ? c.format(r[c.key]) : r[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function TimeChart({ data, dataKey, name, color, format }) {
  return (
    <div className="h-64 px-2 pt-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`fill-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => (format ? format(v, true) : formatNumber(v))} allowDecimals={false} />
          <Tooltip content={<ChartTooltip format={format ? (v) => format(v) : undefined} />} cursor={{ stroke: AXIS, strokeDasharray: "3 3" }} />
          <Area type="monotone" dataKey={dataKey} name={name} stroke={color} strokeWidth={2} fill={`url(#fill-${dataKey})`} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function HBarChart({ data, dataKey, labelKey, name, color, format }) {
  const height = Math.max(120, data.length * 44 + 20);
  return (
    <div className="px-2 pt-4" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 8 }} barCategoryGap={10}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => (format ? format(v, true) : formatNumber(v))} allowDecimals={false} />
          <YAxis type="category" dataKey={labelKey} tick={{ fill: "#334155", fontSize: 12 }} tickLine={false} axisLine={false} width={96} />
          <Tooltip content={<ChartTooltip format={format ? (v) => format(v) : undefined} />} cursor={{ fill: "#f1f5f9" }} />
          <Bar dataKey={dataKey} name={name} fill={color} radius={[0, 4, 4, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AnalyticsDashboard() {
  const [days, setDays] = useState("30");
  const { data, error, loading, reload } = useApi(`/api/admin/analytics?days=${days}`);
  const money = (v, compact) =>
    compact
      ? new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(v)
      : formatCurrency(v, data?.currency || "NGN");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          layoutId="analytics-range"
          value={days}
          onChange={setDays}
          tabs={[
            { value: "7", label: "7 days" },
            { value: "30", label: "30 days" },
            { value: "90", label: "90 days" },
          ]}
        />
        <button type="button" onClick={reload} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh
        </button>
      </div>

      {error ? (
        <Card>
          <ErrorState description={error.message} onRetry={reload} />
        </Card>
      ) : !data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>
          <Skeleton className="h-80 w-full rounded-2xl" />
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total users" value={formatNumber(data.users.total)} hint={`+${data.users.new} new in period`} icon={Users} tone="blue" />
            <StatCard label="Active subscribers" value={formatNumber(data.subscribers.active)} icon={UserCheck} tone="brand" />
            <StatCard label="Expired subscribers" value={formatNumber(data.subscribers.expired)} hint="No active plan now" icon={UserMinus} tone="rose" />
            <StatCard label="Active users (7d)" value={formatNumber(data.users.active7d)} icon={Activity} tone="violet" />
            {data.revenue && (
              <>
                <StatCard label={`Revenue (${data.periodDays}d)`} value={money(data.revenue.period)} hint={`${data.revenue.paymentsInPeriod} payments`} icon={TrendingUp} tone="amber" />
                <StatCard label="Revenue (all time)" value={money(data.revenue.allTime)} icon={Wallet} tone="amber" />
              </>
            )}
            <StatCard label="Codes published" value={formatNumber(data.betCodes.publishedInPeriod)} hint={`${data.betCodes.live} live now`} icon={Ticket} tone="brand" />
            <StatCard label="Code views" value={formatNumber(data.betCodes.viewsInPeriod)} hint={`${formatNumber(data.betCodes.viewsTotal)} all time`} icon={Eye} tone="slate" />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "New subscriptions", value: data.subscriptions.new },
              { label: "Renewals", value: data.subscriptions.renewals },
              { label: "Upgrades", value: data.subscriptions.upgrades },
            ].map((s) => (
              <div key={s.label} className="card flex items-center justify-between p-5">
                <div className="flex items-center gap-3">
                  <Crown className="size-5 text-amber-500" aria-hidden="true" />
                  <span className="text-sm font-medium text-slate-600">{s.label}</span>
                </div>
                <span className="text-2xl font-semibold tabular-nums text-slate-900">{formatNumber(s.value)}</span>
              </div>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            {data.revenue && (
              <Card>
                <CardHeader title="Revenue" description={`Successful payments per day (${data.timezone})`} />
                <TimeChart data={data.series} dataKey="revenue" name="revenue" color={SERIES_1} format={money} />
                <DataTableToggle rows={data.series} columns={[{ key: "date", label: "Date" }, { key: "revenue", label: "Revenue", format: (v) => money(v) }, { key: "payments", label: "Payments" }]} />
              </Card>
            )}
            <Card>
              <CardHeader title="New signups" description="Client accounts created per day" />
              <TimeChart data={data.series} dataKey="signups" name="signups" color={SERIES_3} />
              <DataTableToggle rows={data.series} columns={[{ key: "date", label: "Date" }, { key: "signups", label: "Signups" }]} />
            </Card>
            {data.revenue && (
              <Card>
                <CardHeader title="Revenue by plan" description={`Last ${data.periodDays} days`} />
                {data.revenue.byPlan.length ? (
                  <HBarChart data={data.revenue.byPlan} dataKey="revenue" labelKey="plan" name="revenue" color={SERIES_1} format={money} />
                ) : (
                  <EmptyState title="No revenue in this period" />
                )}
              </Card>
            )}
            <Card>
              <CardHeader title="Active subscribers by plan" description="Right now" />
              {data.subscribers.byPlan.length ? (
                <HBarChart data={data.subscribers.byPlan} dataKey="count" labelKey="plan" name="subscribers" color={SERIES_1} />
              ) : (
                <EmptyState title="No active subscribers" />
              )}
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader title="Most viewed bet codes" />
              {data.betCodes.top.length ? (
                <ol className="divide-y divide-slate-100">
                  {data.betCodes.top.map((c, i) => (
                    <li key={c.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                      <span className="w-5 text-slate-400 tabular-nums">{i + 1}</span>
                      <span className="flex-1 truncate font-medium text-slate-900">{c.title}</span>
                      <span className="tabular-nums text-slate-600">{formatNumber(c.views)} views</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyState title="No views recorded yet" />
              )}
            </Card>
            {data.revenue && (
              <Card>
                <CardHeader title="Recent payments" />
                {data.recentPayments.length ? (
                  <ul className="divide-y divide-slate-100">
                    {data.recentPayments.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">{p.user?.name ?? "—"}</p>
                          <p className="truncate text-xs text-slate-500">
                            {p.planName} · {p.status.toLowerCase()}
                          </p>
                        </div>
                        <span className="font-semibold tabular-nums text-slate-900">{formatCurrency(p.amount, p.currency)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState title="No payments yet" />
                )}
              </Card>
            )}
          </div>
          {!data.revenue && <p className="text-xs text-slate-500">Revenue figures are visible to Super Admins and admins granted full analytics.</p>}
        </>
      )}
    </div>
  );
}
