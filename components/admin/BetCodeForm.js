"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Plus, Rocket, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/client/api";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/Form";
import { COMMON_TIMEZONES, utcToZonedParts } from "@/lib/timezone";
import { cn } from "@/lib/utils";

export function levelOptions(plans = []) {
  const map = new Map([[0, "Free (all registered users)"]]);
  for (const p of [...plans].sort((a, b) => a.accessLevel - b.accessLevel)) {
    const existing = map.get(p.accessLevel);
    map.set(p.accessLevel, existing && p.accessLevel !== 0 ? `${existing} / ${p.name}` : `${p.name}`);
  }
  return [...map.entries()].map(([value, label]) => ({ value, label: value === 0 ? label : `Level ${value} — ${label}` }));
}

function TimezoneSelect({ id, value, onChange }) {
  const zones = COMMON_TIMEZONES.includes(value) ? COMMON_TIMEZONES : [value, ...COMMON_TIMEZONES];
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {zones.map((z) => (
        <option key={z} value={z}>
          {z.replace(/_/g, " ")}
        </option>
      ))}
    </Select>
  );
}

function Segmented({ value, onChange, options, name }) {
  return (
    <div role="radiogroup" aria-label={name} className="grid grid-cols-2 gap-2 sm:flex">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
            value === o.value ? "border-brand-500 bg-brand-50 text-brand-800 ring-2 ring-brand-500/20" : "border-slate-200 text-slate-600 hover:bg-slate-50"
          )}
        >
          {o.icon && <o.icon className="size-4" aria-hidden="true" />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function nowParts(tz) {
  const inHour = new Date(Date.now() + 60 * 60 * 1000);
  const p = utcToZonedParts(inHour, tz);
  return { date: p.date, time: `${p.time.slice(0, 2)}:00` };
}

/** Create / edit a bet code, including release (now / schedule / draft) and expiry. */
export function BetCodeForm({ open, onClose, onSaved, initial, categories, plans, defaultTimezone, canPublish, notifyDefault = true }) {
  const editing = Boolean(initial?.id);
  const levels = useMemo(() => levelOptions(plans), [plans]);

  const blank = useMemo(() => {
    const tz = defaultTimezone || "Africa/Lagos";
    const np = nowParts(tz);
    return {
      title: "",
      code: "",
      bookmaker: "",
      totalOdds: "",
      category: "",
      accessLevel: levels.find((l) => l.value === 1)?.value ?? 1,
      description: "",
      analysis: "",
      isFeatured: false,
      notifyOnRelease: notifyDefault,
      result: "PENDING",
      releaseType: canPublish ? "NOW" : "DRAFT",
      publishDate: np.date,
      publishTime: np.time,
      timezone: tz,
      expiryType: "NONE",
      expiresDate: np.date,
      expiresTime: "23:59",
      expiresInHours: 24,
    };
  }, [defaultTimezone, levels, canPublish, notifyDefault]);

  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (!initial) {
      setForm(blank);
      return;
    }
    const tz = initial.timezone || defaultTimezone;
    const pub = initial.publishAt ? utcToZonedParts(initial.publishAt, tz) : nowParts(tz);
    const exp = initial.expiresAt ? utcToZonedParts(initial.expiresAt, tz) : { date: pub.date, time: "23:59" };
    setForm({
      ...blank,
      title: initial.title,
      code: initial.code,
      bookmaker: initial.bookmaker || "",
      totalOdds: initial.totalOdds ?? "",
      category: initial.category?.id || "",
      accessLevel: initial.accessLevel,
      description: initial.description || "",
      analysis: initial.analysis || "",
      isFeatured: initial.isFeatured,
      notifyOnRelease: initial.notifyOnRelease,
      result: initial.result || "PENDING",
      releaseType: "KEEP",
      publishDate: pub.date,
      publishTime: pub.time,
      timezone: tz,
      expiryType: "KEEP",
      expiresDate: exp.date,
      expiresTime: exp.time,
    });
  }, [open, initial, blank, defaultTimezone]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v?.target ? v.target.value : v }));

  async function submit(e) {
    e?.preventDefault();
    setSaving(true);
    setErrors({});
    const body = {
      title: form.title,
      code: form.code,
      bookmaker: form.bookmaker,
      totalOdds: form.totalOdds === "" ? null : Number(form.totalOdds),
      category: form.category || null,
      accessLevel: Number(form.accessLevel),
      description: form.description,
      analysis: form.analysis,
      isFeatured: form.isFeatured,
      notifyOnRelease: form.notifyOnRelease,
      releaseType: form.releaseType,
      timezone: form.timezone,
      expiryType: form.expiryType,
      ...(form.releaseType === "SCHEDULE" ? { publishDate: form.publishDate, publishTime: form.publishTime } : {}),
      ...(form.expiryType === "DATETIME" ? { expiresDate: form.expiresDate, expiresTime: form.expiresTime } : {}),
      ...(form.expiryType === "HOURS" ? { expiresInHours: Number(form.expiresInHours) } : {}),
      ...(editing ? { result: form.result } : {}),
    };
    try {
      const res = await apiFetch(editing ? `/api/admin/betcodes/${initial.id}` : "/api/admin/betcodes", {
        method: editing ? "PATCH" : "POST",
        body,
      });
      toast.success(editing ? "Bet code updated" : res.betCode?.status === "PUBLISHED" ? "Bet code published" : res.betCode?.status === "SCHEDULED" ? "Bet code scheduled" : "Draft saved");
      onSaved?.(res.betCode);
      onClose();
    } catch (err) {
      setErrors(err.errors || {});
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const releaseOptions = [
    ...(editing ? [{ value: "KEEP", label: "Keep current" }] : []),
    ...(canPublish
      ? [
          { value: "NOW", label: "Publish now", icon: Rocket },
          { value: "SCHEDULE", label: "Schedule", icon: CalendarClock },
        ]
      : []),
    { value: "DRAFT", label: editing ? "Move to draft" : "Save as draft", icon: Save },
  ];

  const submitLabel = form.releaseType === "NOW" ? "Publish now" : form.releaseType === "SCHEDULE" ? "Schedule release" : editing ? "Save changes" : "Save draft";

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? "Edit bet code" : "New bet code"}
      description="Only subscribers at or above the chosen access level will ever receive this code."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-6" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" htmlFor="bc-title" error={errors.title} required className="sm:col-span-2">
            <Input id="bc-title" value={form.title} onChange={set("title")} error={errors.title} placeholder="e.g. Saturday 5-fold accumulator" />
          </Field>
          <Field label="Bet code" htmlFor="bc-code" error={errors.code} required>
            <Input id="bc-code" value={form.code} onChange={set("code")} error={errors.code} className="font-mono uppercase" placeholder="e.g. 3F7K9Q" />
          </Field>
          <Field label="Bookmaker" htmlFor="bc-bookmaker" error={errors.bookmaker}>
            <Input id="bc-bookmaker" value={form.bookmaker} onChange={set("bookmaker")} placeholder="e.g. SportyBet" />
          </Field>
          <Field label="Access level" htmlFor="bc-level" error={errors.accessLevel} required hint="Who can see this code.">
            <Select id="bc-level" value={form.accessLevel} onChange={set("accessLevel")}>
              {levels.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Category" htmlFor="bc-cat" error={errors.category}>
            <Select id="bc-cat" value={form.category} onChange={set("category")}>
              <option value="">Uncategorised</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {!c.isActive ? " (inactive)" : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Total odds" htmlFor="bc-odds" error={errors.totalOdds}>
            <Input id="bc-odds" type="number" step="0.01" min="1" value={form.totalOdds} onChange={set("totalOdds")} placeholder="e.g. 12.50" />
          </Field>
          {editing && (
            <Field label="Result" htmlFor="bc-result">
              <Select id="bc-result" value={form.result} onChange={set("result")}>
                <option value="PENDING">Pending</option>
                <option value="WON">Won</option>
                <option value="LOST">Lost</option>
                <option value="VOID">Void</option>
              </Select>
            </Field>
          )}
          <Field label="Description" htmlFor="bc-desc" error={errors.description} className="sm:col-span-2">
            <Textarea id="bc-desc" rows={3} value={form.description} onChange={set("description")} placeholder="Matches included, markets, key notes…" />
          </Field>
          <Field label="Analysis" htmlFor="bc-analysis" error={errors.analysis} hint="Detailed reasoning shown on the code's detail page." className="sm:col-span-2">
            <Textarea id="bc-analysis" rows={3} value={form.analysis} onChange={set("analysis")} />
          </Field>
        </div>

        <fieldset className="space-y-4 rounded-xl border border-slate-200 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-900">Release</legend>
          <Segmented name="Release type" value={form.releaseType} onChange={set("releaseType")} options={releaseOptions} />
          {form.releaseType === "SCHEDULE" && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Date" htmlFor="bc-date" error={errors.publishDate}>
                <Input id="bc-date" type="date" value={form.publishDate} onChange={set("publishDate")} />
              </Field>
              <Field label="Time" htmlFor="bc-time" error={errors.publishTime}>
                <Input id="bc-time" type="time" value={form.publishTime} onChange={set("publishTime")} />
              </Field>
              <Field label="Timezone" htmlFor="bc-tz">
                <TimezoneSelect id="bc-tz" value={form.timezone} onChange={set("timezone")} />
              </Field>
            </div>
          )}
          <p className="text-xs text-slate-500">
            {form.releaseType === "SCHEDULE"
              ? "The server releases the code at this exact time — no browser needs to stay open."
              : form.releaseType === "NOW"
                ? "Visible to entitled subscribers immediately."
                : form.releaseType === "KEEP"
                  ? "The current release time and status stay unchanged."
                  : "Drafts are never visible to subscribers."}
          </p>
        </fieldset>

        <fieldset className="space-y-4 rounded-xl border border-slate-200 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-900">Expiration</legend>
          <Segmented
            name="Expiry"
            value={form.expiryType}
            onChange={set("expiryType")}
            options={[
              ...(editing ? [{ value: "KEEP", label: "Keep current" }] : []),
              { value: "NONE", label: "No expiry" },
              { value: "HOURS", label: "After hours" },
              { value: "DATETIME", label: "Date & time" },
            ]}
          />
          {form.expiryType === "HOURS" && (
            <Field label="Expire after (hours from release)" htmlFor="bc-exp-h" error={errors.expiresInHours} className="sm:max-w-xs">
              <Input id="bc-exp-h" type="number" min="0.25" step="0.25" value={form.expiresInHours} onChange={set("expiresInHours")} />
            </Field>
          )}
          {form.expiryType === "DATETIME" && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Expiry date" htmlFor="bc-exp-d" error={errors.expiresDate}>
                <Input id="bc-exp-d" type="date" value={form.expiresDate} onChange={set("expiresDate")} />
              </Field>
              <Field label="Expiry time" htmlFor="bc-exp-t">
                <Input id="bc-exp-t" type="time" value={form.expiresTime} onChange={set("expiresTime")} />
              </Field>
              <Field label="Timezone" htmlFor="bc-exp-tz" hint="Same as release timezone.">
                <TimezoneSelect id="bc-exp-tz" value={form.timezone} onChange={set("timezone")} />
              </Field>
            </div>
          )}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Switch id="bc-feat" label="Feature this code" description="Pinned to the top of subscribers' feeds." checked={form.isFeatured} onChange={set("isFeatured")} />
          <Switch id="bc-notify" label="Notify on release" description="In-app + WhatsApp to entitled subscribers only." checked={form.notifyOnRelease} onChange={set("notifyOnRelease")} />
        </div>
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}

const DEFAULT_TIMES = ["10:00", "13:00", "16:00", "20:00"];

/** Schedule several releases for one day, e.g. 10:00 / 13:00 / 16:00 / 20:00. */
export function BatchReleaseModal({ open, onClose, onSaved, categories, plans, defaultTimezone, notifyDefault = true }) {
  const levels = useMemo(() => levelOptions(plans), [plans]);
  const tz0 = defaultTimezone || "Africa/Lagos";
  const today = utcToZonedParts(new Date(), tz0).date;
  const [meta, setMeta] = useState({ date: today, timezone: tz0, category: "", accessLevel: 1, bookmaker: "", expiresInHours: "", notifyOnRelease: notifyDefault });
  const [rows, setRows] = useState(DEFAULT_TIMES.map((time) => ({ time, title: "", code: "", totalOdds: "" })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setMeta((m) => ({ ...m, date: utcToZonedParts(new Date(), m.timezone).date }));
    }
  }, [open]);

  const setRow = (i, k, v) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const items = rows.filter((r) => r.title || r.code).map((r) => ({ ...r, totalOdds: r.totalOdds === "" ? null : Number(r.totalOdds) }));
      const res = await apiFetch("/api/admin/betcodes/batch", {
        method: "POST",
        body: {
          ...meta,
          accessLevel: Number(meta.accessLevel),
          category: meta.category || null,
          expiresInHours: meta.expiresInHours === "" ? null : Number(meta.expiresInHours),
          items,
        },
      });
      toast.success(`${res.count} release${res.count === 1 ? "" : "s"} scheduled`);
      setRows(DEFAULT_TIMES.map((time) => ({ time, title: "", code: "", totalOdds: "" })));
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e.message);
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Schedule releases for a day"
      description="Each row becomes its own bet code, released automatically at its time."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            <CalendarClock className="size-4" /> Schedule {rows.filter((r) => r.title || r.code).length} releases
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Date" htmlFor="b-date">
            <Input id="b-date" type="date" value={meta.date} onChange={(e) => setMeta({ ...meta, date: e.target.value })} />
          </Field>
          <Field label="Timezone" htmlFor="b-tz">
            <TimezoneSelect id="b-tz" value={meta.timezone} onChange={(v) => setMeta({ ...meta, timezone: v })} />
          </Field>
          <Field label="Access level" htmlFor="b-level">
            <Select id="b-level" value={meta.accessLevel} onChange={(e) => setMeta({ ...meta, accessLevel: e.target.value })}>
              {levels.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Category" htmlFor="b-cat">
            <Select id="b-cat" value={meta.category} onChange={(e) => setMeta({ ...meta, category: e.target.value })}>
              <option value="">Uncategorised</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Bookmaker" htmlFor="b-book">
            <Input id="b-book" value={meta.bookmaker} onChange={(e) => setMeta({ ...meta, bookmaker: e.target.value })} />
          </Field>
          <Field label="Expire after (hours)" htmlFor="b-exp" hint="Optional, from each release time.">
            <Input id="b-exp" type="number" min="0.25" step="0.25" value={meta.expiresInHours} onChange={(e) => setMeta({ ...meta, expiresInHours: e.target.value })} />
          </Field>
        </div>

        <div className="space-y-2">
          <div className="hidden grid-cols-[110px_1fr_1fr_110px_40px] gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid">
            <span>Time</span>
            <span>Title</span>
            <span>Code</span>
            <span>Odds</span>
            <span />
          </div>
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 p-2 md:grid-cols-[110px_1fr_1fr_110px_40px] md:border-0 md:p-0">
              <Input type="time" value={r.time} onChange={(e) => setRow(i, "time", e.target.value)} aria-label={`Release ${i + 1} time`} />
              <Input value={r.title} onChange={(e) => setRow(i, "title", e.target.value)} placeholder="Title" aria-label={`Release ${i + 1} title`} className="col-span-2 md:col-span-1" />
              <Input value={r.code} onChange={(e) => setRow(i, "code", e.target.value)} placeholder="Code" className="font-mono uppercase" aria-label={`Release ${i + 1} code`} />
              <Input type="number" step="0.01" min="1" value={r.totalOdds} onChange={(e) => setRow(i, "totalOdds", e.target.value)} placeholder="Odds" aria-label={`Release ${i + 1} odds`} />
              <button type="button" onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))} className="grid size-10 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Remove release ${i + 1}`}>
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setRows((rs) => [...rs, { time: "12:00", title: "", code: "", totalOdds: "" }])} disabled={rows.length >= 24}>
            <Plus className="size-4" /> Add release
          </Button>
        </div>
        <Switch id="b-notify" label="Notify on release" description="Entitled subscribers are notified as each code goes live." checked={meta.notifyOnRelease} onChange={(v) => setMeta({ ...meta, notifyOnRelease: v })} />
        {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      </div>
    </Modal>
  );
}
