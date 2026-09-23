"use client";

import { useState } from "react";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/client/hooks";
import { apiFetch } from "@/lib/client/api";
import { Badge, EmptyState, ErrorState, Skeleton } from "@/components/ui/Primitives";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { Field, Input, Switch, Textarea } from "@/components/ui/Form";

const EMPTY = { name: "", description: "", color: "#10b981", isActive: true, showAsTab: true, sortOrder: 0 };

function CategoryForm({ open, onClose, initial, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [lastOpen, setLastOpen] = useState(false);

  // Reset whenever the dialog opens.
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setForm(initial ? { ...EMPTY, ...initial } : EMPTY);
      setErrors({});
    }
  }

  async function submit(e) {
    e?.preventDefault();
    setSaving(true);
    try {
      const body = { name: form.name, description: form.description, color: form.color, isActive: form.isActive, showAsTab: form.showAsTab, sortOrder: Number(form.sortOrder) || 0 };
      await apiFetch(initial ? `/api/admin/categories/${initial.id}` : "/api/admin/categories", { method: initial ? "PATCH" : "POST", body });
      toast.success(initial ? "Category updated" : "Category created");
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
      title={initial ? "Edit category" : "New category"}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name" htmlFor="c-name" error={errors.name} required>
          <Input id="c-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
        </Field>
        <Field label="Description" htmlFor="c-desc" error={errors.description}>
          <Textarea id="c-desc" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Colour" htmlFor="c-color" error={errors.color}>
            <div className="flex items-center gap-2">
              <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-10 w-12 cursor-pointer rounded-lg border border-slate-300" aria-label="Pick colour" />
              <Input id="c-color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="font-mono" />
            </div>
          </Field>
          <Field label="Sort order" htmlFor="c-sort">
            <Input id="c-sort" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
          </Field>
        </div>
        <Switch id="c-active" label="Active" description="Inactive categories can't be picked for new codes." checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} />
        <Switch id="c-tab" label="Show as dashboard tab" description="Adds a filter tab on subscribers' bet code feed." checked={form.showAsTab} onChange={(v) => setForm({ ...form, showAsTab: v })} />
        <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true" />
      </form>
    </Modal>
  );
}

export function CategoriesManager({ canManage }) {
  const { data, error, loading, reload } = useApi("/api/admin/categories");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/categories/${deleting.id}`, { method: "DELETE" });
      toast.success("Category deleted");
      setDeleting(null);
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  const categories = data?.categories || [];

  return (
    <>
      {canManage && (
        <div className="mb-4 flex justify-end">
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" /> New category
          </Button>
        </div>
      )}
      {error ? (
        <div className="card">
          <ErrorState description={error.message} onRetry={reload} />
        </div>
      ) : loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="card">
          <EmptyState icon={Tags} title="No categories yet" description="Create categories like Football, Basketball or VIP to organise codes." />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <div key={c.id} className="card flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="size-3.5 rounded-full ring-4 ring-slate-50" style={{ backgroundColor: c.color }} aria-hidden="true" />
                  <h3 className="font-semibold text-slate-900">{c.name}</h3>
                </div>
                <div className="flex gap-1">
                  {!c.isActive && <Badge>Inactive</Badge>}
                  {c.showAsTab && c.isActive && <Badge tone="green">Tab</Badge>}
                </div>
              </div>
              <p className="mt-2 flex-1 text-sm text-slate-500">{c.description || "No description"}</p>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-xs text-slate-500">
                  {c.betCodeCount} code{c.betCodeCount === 1 ? "" : "s"} · order {c.sortOrder}
                </span>
                {canManage && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(c);
                        setFormOpen(true);
                      }}
                      className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                      aria-label={`Edit ${c.name}`}
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button type="button" onClick={() => setDeleting(c)} className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600" aria-label={`Delete ${c.name}`}>
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <CategoryForm open={formOpen} onClose={() => setFormOpen(false)} initial={editing} onSaved={reload} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={busy}
        title={`Delete ${deleting?.name}?`}
        confirmLabel="Delete"
        description={deleting?.betCodeCount ? "This category still has bet codes. Deactivate it instead, or move the codes first." : "This can't be undone."}
      />
    </>
  );
}
