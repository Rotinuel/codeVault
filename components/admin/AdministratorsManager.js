"use client";

import { useState } from "react";
import { ShieldCheck, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/client/hooks";
import { apiFetch } from "@/lib/client/api";
import { Avatar, Badge, Card, EmptyState, ErrorState, Skeleton, StatusBadge } from "@/components/ui/Primitives";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/Form";
import { formatDate, timeAgo, titleCase } from "@/lib/utils";

function CreateAdminDialog({ open, onClose, onSaved }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", role: "ADMIN" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e?.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await apiFetch("/api/admin/administrators", { method: "POST", body: { ...form, phone: form.phone || undefined } });
      toast.success("Administrator created");
      setForm({ name: "", email: "", phone: "", password: "", role: "ADMIN" });
      onSaved();
      onClose();
    } catch (err) {
      setErrors(err.errors || {});
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Add administrator"
      description="Share the temporary password securely and ask them to change it after signing in."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            Create account
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name" htmlFor="a-name" error={errors.name} required>
          <Input id="a-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Email" htmlFor="a-email" error={errors.email} required>
          <Input id="a-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Phone" htmlFor="a-phone" error={errors.phone}>
          <Input id="a-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="Temporary password" htmlFor="a-pass" error={errors.password} required hint="At least 8 characters with letters and numbers.">
          <Input id="a-pass" type="text" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <Field label="Role" htmlFor="a-role">
          <Select id="a-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="ADMIN">Admin</option>
            <option value="SUPER_ADMIN">Super Admin</option>
          </Select>
        </Field>
        <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true" />
      </form>
    </Modal>
  );
}

export function AdministratorsManager({ currentUserId }) {
  const { data, error, loading, reload } = useApi("/api/admin/administrators");
  const [createOpen, setCreateOpen] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);

  async function changeRole(admin, role) {
    try {
      await apiFetch(`/api/admin/administrators/${admin.id}`, { method: "PATCH", body: { role } });
      toast.success(`${admin.name} is now ${titleCase(role)}`);
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/administrators/${removing.id}`, { method: "DELETE" });
      toast.success("Administrator access removed");
      setRemoving(null);
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <UserPlus className="size-4" /> Add administrator
        </Button>
      </div>
      <Card className="overflow-hidden">
        {error ? (
          <ErrorState description={error.message} onRetry={reload} />
        ) : loading && !data ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : !data?.administrators?.length ? (
          <EmptyState icon={ShieldCheck} title="No administrators" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.administrators.map((a) => {
              const self = a.id === currentUserId;
              return (
                <li key={a.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar name={a.name} />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium text-slate-900">
                        {a.name} {self && <Badge>You</Badge>}
                      </p>
                      <p className="truncate text-sm text-slate-500">{a.email}</p>
                      <p className="text-xs text-slate-400">
                        Since {formatDate(a.createdAt)} · last login {a.lastLoginAt ? timeAgo(a.lastLoginAt) : "never"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={a.status} />
                    <Select value={a.role} onChange={(e) => changeRole(a, e.target.value)} disabled={self} aria-label={`Role for ${a.name}`} className="h-9 w-40">
                      <option value="ADMIN">Admin</option>
                      <option value="SUPER_ADMIN">Super Admin</option>
                    </Select>
                    {!self && (
                      <Button variant="secondary" size="sm" onClick={() => setRemoving(a)}>
                        <UserMinus className="size-4" /> Remove
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <CreateAdminDialog open={createOpen} onClose={() => setCreateOpen(false)} onSaved={reload} />
      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={remove}
        loading={busy}
        title={`Remove ${removing?.name}?`}
        confirmLabel="Remove access"
        description="Their account becomes a regular client account and they are signed out immediately. Their audit history is kept."
      />
    </>
  );
}
