"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/client/hooks";
import { apiFetch } from "@/lib/client/api";
import { Badge, Card, CardHeader, ErrorState, Skeleton } from "@/components/ui/Primitives";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Switch } from "@/components/ui/Form";
import { COMMON_TIMEZONES } from "@/lib/timezone";
import { NOTIFICATION_EVENT_LABELS, NOTIFICATION_EVENT_VALUES, SUPPORTED_CURRENCIES } from "@/lib/constants";

export function SettingsForm() {
  const router = useRouter();
  const { data, error, reload } = useApi("/api/admin/settings");
  const [s, setS] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (data?.settings) setS(structuredClone(data.settings));
  }, [data]);

  if (error) return <Card><ErrorState description={error.message} onRetry={reload} /></Card>;
  if (!s) return <Skeleton className="h-[600px] w-full rounded-2xl" />;

  const setTop = (k) => (e) => setS((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));
  const setNested = (group, k) => (v) => setS((x) => ({ ...x, [group]: { ...x[group], [k]: v?.target ? v.target.value : v } }));
  const setTemplate = (event, key, value) =>
    setS((x) => ({
      ...x,
      whatsapp: { ...x.whatsapp, templates: { ...x.whatsapp.templates, [event]: { name: "", language: "en", ...x.whatsapp.templates?.[event], [key]: value } } },
    }));

  async function save() {
    setSaving(true);
    setErrors({});
    try {
      const templates = {};
      for (const ev of NOTIFICATION_EVENT_VALUES) {
        const t = s.whatsapp.templates?.[ev];
        if (t) templates[ev] = { name: t.name || "", language: t.language || "en" };
      }
      await apiFetch("/api/admin/settings", {
        method: "PATCH",
        body: {
          platformName: s.platformName,
          tagline: s.tagline,
          logoUrl: s.logoUrl || "",
          supportEmail: s.supportEmail || "",
          supportPhone: s.supportPhone || "",
          currency: s.currency,
          timezone: s.timezone,
          defaultSubscriptionDurationDays: Number(s.defaultSubscriptionDurationDays),
          whatsapp: { enabled: s.whatsapp.enabled, templates },
          notifications: { ...s.notifications, expiryReminderDays: Number(s.notifications.expiryReminderDays) },
          betCodes: {
            ...s.betCodes,
            defaultExpiryHours: Number(s.betCodes.defaultExpiryHours),
            upcomingWindowHours: Number(s.betCodes.upcomingWindowHours),
          },
        },
      });
      toast.success("Settings saved");
      router.refresh();
    } catch (e) {
      setErrors(e.errors || {});
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    try {
      const res = await apiFetch("/api/admin/whatsapp/test", { method: "POST", body: { phone: testPhone } });
      toast.success(res.provider === "console" ? "Logged to server console (dev provider)" : "Test message sent");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setTesting(false);
    }
  }

  const tzOptions = COMMON_TIMEZONES.includes(s.timezone) ? COMMON_TIMEZONES : [s.timezone, ...COMMON_TIMEZONES];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Platform" description="Branding and regional defaults." />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Platform name" htmlFor="s-name" error={errors.platformName}>
            <Input id="s-name" value={s.platformName} onChange={setTop("platformName")} />
          </Field>
          <Field label="Tagline" htmlFor="s-tag" error={errors.tagline}>
            <Input id="s-tag" value={s.tagline} onChange={setTop("tagline")} />
          </Field>
          <Field label="Logo URL" htmlFor="s-logo" error={errors.logoUrl} hint="Square image, https:// URL. Leave blank for the default mark.">
            <Input id="s-logo" value={s.logoUrl} onChange={setTop("logoUrl")} placeholder="https://…" />
          </Field>
          <Field label="Support email" htmlFor="s-email" error={errors.supportEmail}>
            <Input id="s-email" type="email" value={s.supportEmail} onChange={setTop("supportEmail")} />
          </Field>
          <Field label="Support phone" htmlFor="s-phone" error={errors.supportPhone}>
            <Input id="s-phone" value={s.supportPhone} onChange={setTop("supportPhone")} />
          </Field>
          <Field label="Currency" htmlFor="s-cur" hint="Applied to new plans. Must be enabled on your Paystack account.">
            <Select id="s-cur" value={s.currency} onChange={setTop("currency")}>
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Timezone" htmlFor="s-tz" hint="Used for “Today”, schedules and analytics.">
            <Select id="s-tz" value={s.timezone} onChange={setTop("timezone")}>
              {tzOptions.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Default subscription duration (days)" htmlFor="s-dur" error={errors.defaultSubscriptionDurationDays}>
            <Input id="s-dur" type="number" min="1" value={s.defaultSubscriptionDurationDays} onChange={setTop("defaultSubscriptionDurationDays")} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Bet code publishing" />
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <Switch id="s-locked" label="Show locked previews" description="Show higher-tier teasers (title only, never the code) to encourage upgrades." checked={s.betCodes.showLockedPreviews} onChange={setNested("betCodes", "showLockedPreviews")} />
          <Switch id="s-notify" label="Notify on publish by default" description="Pre-ticks “Notify on release” for new codes." checked={s.betCodes.notifyOnPublishDefault} onChange={setNested("betCodes", "notifyOnPublishDefault")} />
          <Field label="Default expiry (hours, 0 = none)" htmlFor="s-exp">
            <Input id="s-exp" type="number" min="0" value={s.betCodes.defaultExpiryHours} onChange={setNested("betCodes", "defaultExpiryHours")} />
          </Field>
          <Field label="“Upcoming” window (hours)" htmlFor="s-up" hint="How far ahead subscribers can see scheduled releases.">
            <Input id="s-up" type="number" min="1" value={s.betCodes.upcomingWindowHours} onChange={setNested("betCodes", "upcomingWindowHours")} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="WhatsApp notifications"
          description="Credentials are read from environment variables and never shown here."
          action={
            data?.whatsapp && (
              <Badge tone={data.whatsapp.live ? "green" : "amber"} icon={MessageCircle}>
                {data.whatsapp.live ? "Cloud API connected" : data.whatsapp.configured ? "Dev console provider" : "Not configured"}
              </Badge>
            )
          }
        />
        <div className="space-y-5 p-5">
          <Switch id="s-wa" label="Enable WhatsApp notifications" description="Password reset links are always sent when a provider is configured." checked={s.whatsapp.enabled} onChange={(v) => setS((x) => ({ ...x, whatsapp: { ...x.whatsapp, enabled: v } }))} />
          <div className="grid gap-5 sm:grid-cols-2">
            {[
              ["registration", "Registration welcome"],
              ["subscriptionActivated", "Subscription activated"],
              ["paymentSuccess", "Payment successful"],
              ["paymentFailed", "Payment failed"],
              ["expiryReminder", "Expiry reminder"],
              ["subscriptionExpired", "Subscription expired"],
              ["betCodeReleased", "Bet code released"],
            ].map(([k, label]) => (
              <Switch key={k} id={`s-n-${k}`} label={label} checked={s.notifications[k]} onChange={setNested("notifications", k)} />
            ))}
            <Field label="Send expiry reminder (days before)" htmlFor="s-rem">
              <Input id="s-rem" type="number" min="1" max="30" value={s.notifications.expiryReminderDays} onChange={setNested("notifications", "expiryReminderDays")} />
            </Field>
          </div>

          <details className="rounded-xl border border-slate-200 p-4">
            <summary className="cursor-pointer text-sm font-medium text-slate-800">Message templates (optional)</summary>
            <p className="mt-2 text-xs text-slate-500">
              Business-initiated WhatsApp messages outside the 24-hour window require Meta-approved templates. Enter the template name per event; body
              variables are filled in order (e.g. name, plan, date). Leave blank to send plain text.
            </p>
            <div className="mt-4 space-y-3">
              {NOTIFICATION_EVENT_VALUES.map((ev) => (
                <div key={ev} className="grid gap-2 sm:grid-cols-[1fr_1fr_90px] sm:items-center">
                  <span className="text-sm text-slate-700">{NOTIFICATION_EVENT_LABELS[ev]}</span>
                  <Input value={s.whatsapp.templates?.[ev]?.name || ""} onChange={(e) => setTemplate(ev, "name", e.target.value)} placeholder="template_name" aria-label={`${NOTIFICATION_EVENT_LABELS[ev]} template`} />
                  <Input value={s.whatsapp.templates?.[ev]?.language || "en"} onChange={(e) => setTemplate(ev, "language", e.target.value)} aria-label={`${NOTIFICATION_EVENT_LABELS[ev]} language`} />
                </div>
              ))}
            </div>
          </details>

          <div className="flex flex-col gap-2 rounded-xl bg-slate-50 p-4 sm:flex-row sm:items-end">
            <Field label="Send a test message to" htmlFor="s-test" className="flex-1">
              <Input id="s-test" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="+2348012345678" />
            </Field>
            <Button variant="secondary" onClick={sendTest} loading={testing} disabled={!testPhone}>
              <Send className="size-4" /> Send test
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Integrations status" />
        <div className="flex flex-wrap gap-2 p-5">
          <Badge tone={data?.paystack?.configured ? "green" : "red"}>Paystack: {data?.paystack?.configured ? `${data.paystack.mode} mode` : "missing secret key"}</Badge>
          <Badge tone={data?.cron?.configured ? "green" : "amber"}>Cron secret: {data?.cron?.configured ? "set" : "not set"}</Badge>
        </div>
      </Card>

      <div className="sticky bottom-4 flex justify-end">
        <Button size="lg" onClick={save} loading={saving} className="shadow-lg">
          Save settings
        </Button>
      </div>
    </div>
  );
}
