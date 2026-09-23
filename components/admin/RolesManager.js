"use client";

import { useEffect, useState } from "react";
import { Check, Lock, Minus } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/client/hooks";
import { apiFetch } from "@/lib/client/api";
import { Badge, Card, CardHeader, ErrorState, Skeleton } from "@/components/ui/Primitives";
import { Button } from "@/components/ui/Button";

export function RolesManager() {
  const { data, error, reload } = useApi("/api/admin/roles");
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setSelected(new Set(data.adminPermissions));
  }, [data]);

  if (error) return <Card><ErrorState description={error.message} onRetry={reload} /></Card>;
  if (!data || !selected) return <Skeleton className="h-96 w-full rounded-2xl" />;

  const dirty = data.adminPermissions.length !== selected.size || data.adminPermissions.some((p) => !selected.has(p));

  function toggle(key) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      await apiFetch("/api/admin/roles", { method: "PATCH", body: { adminPermissions: [...selected] } });
      toast.success("Permissions updated for all Admins");
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Permission matrix"
        description="Super Admins always hold every permission. Choose what regular Admins may do; Super-Admin-only permissions can't be delegated."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setSelected(new Set(data.defaults))}>
              Reset to defaults
            </Button>
            <Button size="sm" onClick={save} loading={saving} disabled={!dirty}>
              Save changes
            </Button>
          </div>
        }
      />
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-5 py-3 font-semibold">Permission</th>
              <th className="w-32 px-5 py-3 text-center font-semibold">Super Admin</th>
              <th className="w-32 px-5 py-3 text-center font-semibold">Admin</th>
              <th className="w-32 px-5 py-3 text-center font-semibold">User</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.permissions.map((p) => (
              <tr key={p.key} className="hover:bg-slate-50/60">
                <td className="px-5 py-3">
                  <p className="font-medium text-slate-900">{p.label}</p>
                  <p className="font-mono text-xs text-slate-400">{p.key}</p>
                </td>
                <td className="px-5 py-3 text-center">
                  <Check className="mx-auto size-4 text-brand-600" aria-label="Granted" />
                </td>
                <td className="px-5 py-3 text-center">
                  {p.superAdminOnly ? (
                    <Badge icon={Lock}>Super only</Badge>
                  ) : (
                    <input type="checkbox" checked={selected.has(p.key)} onChange={() => toggle(p.key)} className="size-4 accent-brand-600" aria-label={`Allow Admins: ${p.label}`} />
                  )}
                </td>
                <td className="px-5 py-3 text-center">
                  <Minus className="mx-auto size-4 text-slate-300" aria-label="Not granted" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
        Clients (User role) can only access their own dashboard, subscription and payments. Every permission is enforced by the API, not just hidden in the UI.
      </p>
    </Card>
  );
}
