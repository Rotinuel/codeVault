"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Ban, CalendarPlus, Crown, KeyRound, UserCheck, UserX, CircleX } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/client/hooks";
import { apiFetch } from "@/lib/client/api";
import { Avatar, Badge, Card, CardHeader, EmptyState, ErrorState, Skeleton, StatusBadge } from "@/components/ui/Primitives";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { ResetLinkDialog, StatusChangeDialog } from "./UsersManager";
import { formatCurrency, formatDate, formatDateTime, titleCase } from "@/lib/utils";

function ManualSubscriptionDialog({ open, onClose, userId, action, plans, onDone }) {
  const [planId, setPlanId] = useState("");
  const [days, setDays] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const title = action === "GRANT" ? "Grant subscription" : action === "EXTEND" ? "Extend subscription" : "Cancel subscription";

  async function submit() {
    setLoading(true);
    try {
      await apiFetch(`/api/admin/users/${userId}/subscription`, {
        method: "POST",
        body: { action, planId: planId || undefined, days: days ? Number(days) : undefined, notes },
      });
      toast.success(`${title} — done`);
      onDone();
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description="Manual changes are recorded in the audit log."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button variant={action === "CANCEL" ? "danger" : "primary"} onClick={submit} loading={loading}>
            {title}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {action === "GRANT" && (
          <>
            <Field label="Plan" htmlFor="m-plan" required>
              <Select id="m-plan" value={planId} onChange={(e) => setPlanId(e.target.value)}>
                <option value="">Choose a plan…</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (level {p.accessLevel}, {p.durationDays} days)
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Duration override (days)" htmlFor="m-days" hint="Leave blank to use the plan's duration.">
              <Input id="m-days" type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} />
            </Field>
          </>
        )}
        {action === "EXTEND" && (
          <Field label="Extra days" htmlFor="m-days" required>
            <Input id="m-days" type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} />
          </Field>
        )}
        {action === "CANCEL" && <p className="text-sm text-slate-600">The user loses access immediately. This does not refund any payment.</p>}
        <Field label="Internal note" htmlFor="m-notes">
          <Textarea id="m-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

export function UserDetail({ id, isSuper, canManage, canManageSubscriptions }) {
  const { data, error, loading, reload } = useApi(`/api/admin/users/${id}`);
  const plansApi = useApi(canManageSubscriptions ? "/api/admin/plans" : null, { enabled: canManageSubscriptions });
  const [statusTarget, setStatusTarget] = useState(null);
  const [resetUser, setResetUser] = useState(null);
  const [subAction, setSubAction] = useState(null);
  const [role, setRole] = useState("");
  const [savingRole, setSavingRole] = useState(false);

  if (error) return <Card><ErrorState description={error.message} onRetry={reload} /></Card>;
  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const u = data.user;
  const active = data.subscriptions.find((s) => s.status === "ACTIVE" && new Date(s.endDate) > new Date() && new Date(s.startDate) <= new Date());
  const manageable = canManage && data.canManage;

  async function saveRole() {
    if (!role || role === u.role) return;
    setSavingRole(true);
    try {
      await apiFetch(`/api/admin/users/${id}`, { method: "PATCH", body: { role } });
      toast.success("Role updated");
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingRole(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" aria-hidden="true" /> All users
      </Link>

      <Card className="p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={u.name} className="size-14 text-base" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-slate-900">{u.name}</h1>
                <StatusBadge status={u.status} />
                <Badge tone={u.role === "USER" ? "gray" : "violet"}>{titleCase(u.role)}</Badge>
              </div>
              <p className="text-sm text-slate-500">
                {u.email} · {u.phone || "no phone"}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Joined {formatDate(u.createdAt)} · last login {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "never"}
              </p>
              {u.statusReason && <p className="mt-1 text-xs text-amber-700">Reason: {u.statusReason}</p>}
            </div>
          </div>
          {manageable && (
            <div className="flex flex-wrap gap-2">
              {u.status !== "ACTIVE" && (
                <Button variant="secondary" size="sm" onClick={() => setStatusTarget({ user: u, status: "ACTIVE" })}>
                  <UserCheck className="size-4" /> Reactivate
                </Button>
              )}
              {u.status === "ACTIVE" && (
                <Button variant="secondary" size="sm" onClick={() => setStatusTarget({ user: u, status: "SUSPENDED" })}>
                  <UserX className="size-4" /> Suspend
                </Button>
              )}
              {u.status !== "BANNED" && (
                <Button variant="danger" size="sm" onClick={() => setStatusTarget({ user: u, status: "BANNED" })}>
                  <Ban className="size-4" /> Ban
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => setResetUser(u)}>
                <KeyRound className="size-4" /> Reset link
              </Button>
            </div>
          )}
        </div>
      </Card>

      {u.role === "USER" && (
        <Card>
          <CardHeader
            title="Subscription"
            description={active ? `${active.planName} · level ${active.accessLevel} · ${active.daysRemaining} days left` : "No active subscription"}
            action={
              canManageSubscriptions && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setSubAction("GRANT")}>
                    <Crown className="size-4" /> Grant
                  </Button>
                  {active && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => setSubAction("EXTEND")}>
                        <CalendarPlus className="size-4" /> Extend
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setSubAction("CANCEL")}>
                        <CircleX className="size-4" /> Cancel
                      </Button>
                    </>
                  )}
                </div>
              )
            }
          />
          {data.subscriptions.length === 0 ? (
            <EmptyState title="No subscription history" />
          ) : (
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Plan</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Period</th>
                    <th className="px-4 py-3 font-semibold">Price</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.subscriptions.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{s.planName}</td>
                      <td className="px-4 py-3 text-slate-600">{titleCase(s.type)}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDate(s.startDate)} → {formatDate(s.endDate)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">{formatCurrency(s.price, s.currency)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={s.status === "ACTIVE" && new Date(s.endDate) <= new Date() ? "EXPIRED" : s.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {data.payments.length > 0 && (
        <Card>
          <CardHeader title="Payments" description="Most recent 20 transactions." />
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Reference</th>
                  <th className="px-4 py-3 font-semibold">Plan</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-mono text-xs">{p.reference}</td>
                    <td className="px-4 py-3">{p.planName}</td>
                    <td className="px-4 py-3 tabular-nums">{formatCurrency(p.amount, p.currency)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDateTime(p.paidAt || p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {isSuper && data.canManage && (
        <Card id="role">
          <CardHeader title="Role" description="Promoting to Admin grants access to the admin panel. Changing a role signs the user out." />
          <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
            <Field label="Role" htmlFor="role" className="sm:w-64">
              <Select id="role" value={role || u.role} onChange={(e) => setRole(e.target.value)}>
                <option value="USER">User</option>
                <option value="ADMIN">Admin</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </Select>
            </Field>
            <Button onClick={saveRole} loading={savingRole} disabled={!role || role === u.role}>
              Save role
            </Button>
          </div>
        </Card>
      )}

      <StatusChangeDialog target={statusTarget} onClose={() => setStatusTarget(null)} onDone={reload} />
      <ResetLinkDialog user={resetUser} onClose={() => setResetUser(null)} />
      {canManageSubscriptions && (
        <ManualSubscriptionDialog
          open={Boolean(subAction)}
          action={subAction}
          userId={id}
          plans={plansApi.data?.plans || []}
          onClose={() => setSubAction(null)}
          onDone={reload}
        />
      )}
    </div>
  );
}
