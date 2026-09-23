"use client";

import { useState } from "react";
import { Megaphone, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/client/hooks";
import { apiFetch } from "@/lib/client/api";
import { Badge, Card, CardHeader, EmptyState, StatusBadge } from "@/components/ui/Primitives";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Modal";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/Form";
import { formatDateTime, timeAgo, titleCase } from "@/lib/utils";

const AUDIENCES = [
  { value: "SUBSCRIBERS", label: "All active subscribers" },
  { value: "MIN_LEVEL", label: "Subscribers at or above a level" },
  { value: "PLAN", label: "Subscribers on a specific plan" },
  { value: "EXPIRED", label: "Expired subscribers (win-back)" },
  { value: "UNSUBSCRIBED", label: "Users without an active plan" },
  { value: "ALL", label: "Every client account" },
];

export function NotificationsCenter() {
  const overview = useApi("/api/admin/notifications");
  const plans = useApi("/api/admin/plans");
  const [form, setForm] = useState({ title: "", message: "", audience: "SUBSCRIBERS", minLevel: 2, planId: "", inApp: true, whatsapp: false });
  const [errors, setErrors] = useState({});
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const wa = overview.data?.whatsapp;

  async function send() {
    setSending(true);
    setErrors({});
    try {
      const res = await apiFetch("/api/admin/notifications", {
        method: "POST",
        body: {
          title: form.title,
          message: form.message,
          audience: form.audience,
          ...(form.audience === "MIN_LEVEL" ? { minLevel: Number(form.minLevel) } : {}),
          ...(form.audience === "PLAN" ? { planId: form.planId } : {}),
          inApp: form.inApp,
          whatsapp: form.whatsapp,
        },
      });
      toast.success(`Sent to ${res.recipients} user${res.recipients === 1 ? "" : "s"}${res.whatsappQueued ? ` · ${res.whatsappQueued} WhatsApp queued` : ""}`);
      setForm((f) => ({ ...f, title: "", message: "" }));
      setConfirm(false);
      overview.reload();
    } catch (e) {
      setErrors(e.errors || {});
      toast.error(e.message);
      setConfirm(false);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-5">
      <Card className="xl:col-span-3">
        <CardHeader title="Send a notification" description="Delivered in-app and, optionally, via WhatsApp — only to the audience you choose." />
        <div className="space-y-4 p-5">
          <Field label="Title" htmlFor="n-title" error={errors.title} required>
            <Input id="n-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} error={errors.title} />
          </Field>
          <Field label="Message" htmlFor="n-msg" error={errors.message} required hint={`${form.message.length}/2000`}>
            <Textarea id="n-msg" rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} error={errors.message} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Audience" htmlFor="n-aud">
              <Select id="n-aud" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
                {AUDIENCES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </Select>
            </Field>
            {form.audience === "MIN_LEVEL" && (
              <Field label="Minimum access level" htmlFor="n-level" error={errors.minLevel}>
                <Input id="n-level" type="number" min="1" value={form.minLevel} onChange={(e) => setForm({ ...form, minLevel: e.target.value })} />
              </Field>
            )}
            {form.audience === "PLAN" && (
              <Field label="Plan" htmlFor="n-plan" error={errors.planId}>
                <Select id="n-plan" value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })}>
                  <option value="">Choose a plan…</option>
                  {(plans.data?.plans || []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
          <div className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
            <Switch id="n-inapp" label="In-app notification" checked={form.inApp} onChange={(v) => setForm({ ...form, inApp: v })} />
            <Switch
              id="n-wa"
              label="WhatsApp"
              description={wa && !wa.enabled ? "WhatsApp is disabled in settings — messages will be skipped." : "Respects each user's WhatsApp preference."}
              checked={form.whatsapp}
              onChange={(v) => setForm({ ...form, whatsapp: v })}
            />
          </div>
          {errors.inApp && <p className="text-xs font-medium text-rose-600">{errors.inApp}</p>}
          <div className="flex justify-end">
            <Button onClick={() => setConfirm(true)} disabled={!form.title || !form.message}>
              <Send className="size-4" /> Send notification
            </Button>
          </div>
        </div>
      </Card>

      <div className="space-y-6 xl:col-span-2">
        <Card>
          <CardHeader title="WhatsApp delivery" description="Last 7 days" />
          <div className="space-y-4 p-5">
            {wa && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <MessageCircle className="size-4 text-emerald-600" aria-hidden="true" />
                <span className="font-medium text-slate-900">Provider: {wa.provider}</span>
                <Badge tone={wa.live ? "green" : "amber"}>{wa.live ? "Live" : wa.configured ? "Development (console)" : "Not configured"}</Badge>
                <Badge tone={wa.enabled ? "green" : "gray"}>{wa.enabled ? "Enabled" : "Disabled"}</Badge>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
              {["SENT", "QUEUED", "FAILED", "SKIPPED"].map((s) => (
                <div key={s} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{titleCase(s)}</p>
                  <p className="text-xl font-semibold tabular-nums text-slate-900">{overview.data?.outboxStats?.[s] || 0}</p>
                </div>
              ))}
            </div>
          </div>
          {overview.data?.recentMessages?.length > 0 && (
            <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto border-t border-slate-100">
              {overview.data.recentMessages.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">{titleCase(m.event)}</p>
                    <p className="truncate text-xs text-slate-500" title={m.lastError || ""}>
                      {m.to} · {timeAgo(m.createdAt)}
                      {m.lastError ? ` · ${m.lastError}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={m.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="xl:col-span-5">
        <CardHeader title="Broadcast history" />
        {!overview.data?.broadcasts?.length ? (
          <EmptyState icon={Megaphone} title="No broadcasts yet" description="Notifications you send from here will be listed with their reach." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {overview.data.broadcasts.map((b) => (
              <li key={b.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{b.title}</p>
                  <p className="line-clamp-1 text-sm text-slate-500">{b.message}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {titleCase(b.audience.kind)} · by {b.sentBy} · {formatDateTime(b.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Badge tone="blue">{b.recipientCount} recipients</Badge>
                  {b.channels.whatsapp && <Badge tone="green">{b.whatsappQueued} WhatsApp</Badge>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={send}
        loading={sending}
        tone="primary"
        title="Send this notification?"
        confirmLabel="Send now"
        description={`It will go to: ${AUDIENCES.find((a) => a.value === form.audience)?.label}. This can't be undone.`}
      />
    </div>
  );
}
