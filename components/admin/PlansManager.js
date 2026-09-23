"use client";

import { useState } from "react";
import { Crown, Layers, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/client/hooks";
import { apiFetch } from "@/lib/client/api";
import { Badge, EmptyState, ErrorState, Skeleton } from "@/components/ui/Primitives";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { Field, Input, Switch, Textarea } from "@/components/ui/Form";
import { formatCurrency } from "@/lib/utils";

function PlanForm({ open, onClose, initial, onSaved, defaultDuration, currency }) {
  const empty = {
    name: "",
    slug: "",
    description: "",
    price: "",
    durationDays: defaultDuration,
    accessLevel: 1,
    features: [""],
    historyDays: "",
    priorityNotifications: false,
    isActive: true,
    isFeatured: false,
    badge: "",
    sortOrder: 0,
  };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [lastOpen, setLastOpen] = useState(false);

  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setErrors({});
      setForm(
        initial
          ? { ...empty, ...initial, historyDays: initial.historyDays ?? "", features: initial.features.length ? initial.features : [""] }
          : empty
      );
    }
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  async function submit(e) {
    e?.preventDefault();
    setSaving(true);
    setErrors({});
    const body = {
      name: form.name,
      ...(form.slug ? { slug: form.slug } : {}),
      description: form.description,
      price: Number(form.price),
      durationDays: Number(form.durationDays),
      accessLevel: Number(form.accessLevel),
      features: form.features.map((f) => f.trim()).filter(Boolean),
      historyDays: form.historyDays === "" ? null : Number(form.historyDays),
      priorityNotifications: form.priorityNotifications,
      isActive: form.isActive,
      isFeatured: form.isFeatured,
      badge: form.badge,
      sortOrder: Number(form.sortOrder) || 0,
    };
    try {
      await apiFetch(initial ? `/api/admin/plans/${initial.id}` : "/api/admin/plans", { method: initial ? "PATCH" : "POST", body });
      toast.success(initial ? "Plan updated" : "Plan created");
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
      size="lg"
      title={initial ? `Edit ${initial.name}` : "New subscription plan"}
      description="Existing subscribers keep the terms they paid for; changes apply to new purchases."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            Save plan
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Plan name" htmlFor="p-name" error={errors.name} required>
            <Input id="p-name" value={form.name} onChange={set("name")} error={errors.name} placeholder="e.g. Premium" />
          </Field>
          <Field label="Slug" htmlFor="p-slug" error={errors.slug} hint="Auto-generated from the name if blank.">
            <Input id="p-slug" value={form.slug} onChange={set("slug")} placeholder="premium" />
          </Field>
          <Field label={`Price (${currency})`} htmlFor="p-price" error={errors.price} required hint="Use 0 for a one-time free trial plan.">
            <Input id="p-price" type="number" min="0" step="0.01" value={form.price} onChange={set("price")} error={errors.price} />
          </Field>
          <Field label="Duration (days)" htmlFor="p-duration" error={errors.durationDays} required>
            <Input id="p-duration" type="number" min="1" value={form.durationDays} onChange={set("durationDays")} error={errors.durationDays} />
          </Field>
          <Field label="Access level" htmlFor="p-level" error={errors.accessLevel} required hint="Subscribers see codes at this level and below.">
            <Input id="p-level" type="number" min="1" max="100" value={form.accessLevel} onChange={set("accessLevel")} error={errors.accessLevel} />
          </Field>
          <Field label="History window (days)" htmlFor="p-history" error={errors.historyDays} hint="Blank = full history.">
            <Input id="p-history" type="number" min="1" value={form.historyDays} onChange={set("historyDays")} />
          </Field>
          <Field label="Badge" htmlFor="p-badge" hint="Optional label, e.g. “Best value”.">
            <Input id="p-badge" value={form.badge} onChange={set("badge")} />
          </Field>
          <Field label="Sort order" htmlFor="p-sort">
            <Input id="p-sort" type="number" value={form.sortOrder} onChange={set("sortOrder")} />
          </Field>
          <Field label="Description" htmlFor="p-desc" className="sm:col-span-2">
            <Textarea id="p-desc" rows={2} value={form.description} onChange={set("description")} />
          </Field>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Features</p>
          <div className="space-y-2">
            {form.features.map((f, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={f}
                  onChange={(e) => setForm((s) => ({ ...s, features: s.features.map((x, idx) => (idx === i ? e.target.value : x)) }))}
                  placeholder="e.g. Premium bet codes"
                  aria-label={`Feature ${i + 1}`}
                />
                <button type="button" onClick={() => setForm((s) => ({ ...s, features: s.features.filter((_, idx) => idx !== i) }))} className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100" aria-label={`Remove feature ${i + 1}`}>
                  <X className="size-4" />
                </button>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setForm((s) => ({ ...s, features: [...s.features, ""] }))}>
              <Plus className="size-4" /> Add feature
            </Button>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Switch id="p-active" label="Active" description="Visible and purchasable." checked={form.isActive} onChange={set("isActive")} />
          <Switch id="p-featured" label="Featured" description="Highlighted on pricing." checked={form.isFeatured} onChange={set("isFeatured")} />
          <Switch id="p-priority" label="Priority alerts" description="Notified first on releases." checked={form.priorityNotifications} onChange={set("priorityNotifications")} />
        </div>
        <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true" />
      </form>
    </Modal>
  );
}

export function PlansManager({ defaultDuration = 30, currency = "NGN" }) {
  const { data, error, loading, reload } = useApi("/api/admin/plans");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const plans = data?.plans || [];

  async function remove() {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/plans/${deleting.id}`, { method: "DELETE" });
      toast.success("Plan deleted");
      setDeleting(null);
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
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="size-4" /> New plan
        </Button>
      </div>
      {error ? (
        <div className="card">
          <ErrorState description={error.message} onRetry={reload} />
        </div>
      ) : loading && !data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="card">
          <EmptyState icon={Layers} title="No plans yet" description="Create plans such as Basic, Standard, Premium and VIP." />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((p) => (
            <div key={p.id} className="card flex flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    {p.accessLevel >= 3 && <Crown className="size-4 text-gold-500" aria-hidden="true" />}
                    <h3 className="font-semibold text-slate-900">{p.name}</h3>
                  </div>
                  <p className="font-mono text-xs text-slate-400">{p.slug}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge tone="gold">Level {p.accessLevel}</Badge>
                  {!p.isActive && <Badge>Inactive</Badge>}
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold tabular-nums text-slate-900">
                {formatCurrency(p.price, p.currency)}
                <span className="ml-1 text-sm font-normal text-slate-500">/ {p.durationDays}d</span>
              </p>
              <ul className="mt-3 flex-1 space-y-1 text-sm text-slate-600">
                {p.features.slice(0, 5).map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-xs text-slate-500">
                  {p.activeSubscribers} active · {p.historyDays ? `${p.historyDays}d history` : "full history"}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(p);
                      setFormOpen(true);
                    }}
                    className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                    aria-label={`Edit ${p.name}`}
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button type="button" onClick={() => setDeleting(p)} className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600" aria-label={`Delete ${p.name}`}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <PlanForm open={formOpen} onClose={() => setFormOpen(false)} initial={editing} onSaved={reload} defaultDuration={defaultDuration} currency={currency} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={busy}
        title={`Delete ${deleting?.name}?`}
        confirmLabel="Delete plan"
        description="Plans with subscription or payment history can't be deleted — deactivate them instead so existing subscribers are unaffected."
      />
    </>
  );
}
