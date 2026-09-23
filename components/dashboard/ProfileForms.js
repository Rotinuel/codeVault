"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogOut } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/client/api";
import { Button } from "@/components/ui/Button";
import { Field, Input, Switch } from "@/components/ui/Form";
import { CardHeader } from "@/components/ui/Primitives";
import { ConfirmDialog } from "@/components/ui/Modal";

export function ProfileForm({ user }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: user.name, phone: user.phone || "" });
  const [prefs, setPrefs] = useState(user.notificationPrefs);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await apiFetch("/api/auth/profile", { method: "PATCH", body: { name: form.name, phone: form.phone || undefined, notificationPrefs: prefs } });
      toast.success("Profile updated");
      router.refresh();
    } catch (err) {
      setErrors(err.errors || {});
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="card">
      <CardHeader title="Profile" description="Your name and WhatsApp number for notifications." />
      <div className="grid gap-5 p-5 sm:grid-cols-2">
        <Field label="Full name" htmlFor="name" error={errors.name} required>
          <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} autoComplete="name" required />
        </Field>
        <Field label="Email" htmlFor="email" hint="Contact support to change your email address.">
          <Input id="email" value={user.email} disabled />
        </Field>
        <Field label="WhatsApp number" htmlFor="phone" error={errors.phone} hint="Include your country code, e.g. +2348012345678.">
          <Input id="phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={errors.phone} autoComplete="tel" />
        </Field>
      </div>
      <div className="border-t border-slate-100 p-5">
        <h3 className="text-sm font-semibold text-slate-900">Notification preferences</h3>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Switch id="p-wa" label="WhatsApp messages" description="Master switch for all WhatsApp notifications." checked={prefs.whatsapp} onChange={(v) => setPrefs({ ...prefs, whatsapp: v })} />
          <Switch id="p-bc" label="New bet codes" description="When a code for your plan is released." checked={prefs.betCodes} onChange={(v) => setPrefs({ ...prefs, betCodes: v })} />
          <Switch id="p-pay" label="Payments" description="Receipts and failed payment alerts." checked={prefs.payments} onChange={(v) => setPrefs({ ...prefs, payments: v })} />
          <Switch id="p-sub" label="Subscription" description="Activation, expiry reminders and expiry." checked={prefs.subscription} onChange={(v) => setPrefs({ ...prefs, subscription: v })} />
        </div>
        <p className="mt-4 text-xs text-slate-500">In-app notifications are always kept in your inbox.</p>
      </div>
      <div className="flex justify-end border-t border-slate-100 bg-slate-50/60 px-5 py-3">
        <Button type="submit" loading={saving}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

function PasswordInput({ id, value, onChange, error, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? "text" : "password"} value={value} onChange={onChange} error={error} autoComplete={autoComplete} className="pr-10" required />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600" aria-label={show ? "Hide password" : "Show password"}>
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function ChangePasswordForm() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (form.newPassword !== form.confirm) {
      setErrors({ confirm: "Passwords don't match" });
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      await apiFetch("/api/auth/change-password", { method: "POST", body: { currentPassword: form.currentPassword, newPassword: form.newPassword } });
      toast.success("Password changed. Other devices were signed out.");
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
    } catch (err) {
      setErrors(err.errors || { currentPassword: err.message });
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="card">
      <CardHeader title="Change password" description="Use at least 8 characters with letters and numbers." />
      <div className="grid gap-5 p-5 sm:grid-cols-3">
        <Field label="Current password" htmlFor="cp" error={errors.currentPassword}>
          <PasswordInput id="cp" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} error={errors.currentPassword} autoComplete="current-password" />
        </Field>
        <Field label="New password" htmlFor="np" error={errors.newPassword}>
          <PasswordInput id="np" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} error={errors.newPassword} autoComplete="new-password" />
        </Field>
        <Field label="Confirm new password" htmlFor="cf" error={errors.confirm}>
          <PasswordInput id="cf" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} error={errors.confirm} autoComplete="new-password" />
        </Field>
      </div>
      <div className="flex justify-end border-t border-slate-100 bg-slate-50/60 px-5 py-3">
        <Button type="submit" loading={saving}>
          Update password
        </Button>
      </div>
    </form>
  );
}

export function SessionsCard() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function logoutAll() {
    setLoading(true);
    try {
      await apiFetch("/api/auth/logout?all=1", { method: "POST" });
      toast.success("Signed out on all devices");
      router.replace("/login");
      router.refresh();
    } catch (e) {
      toast.error(e.message);
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <CardHeader title="Sessions" description="Sign out everywhere if you think someone else has access to your account." />
      <div className="p-5">
        <Button variant="secondary" onClick={() => setOpen(true)}>
          <LogOut className="size-4" /> Sign out of all devices
        </Button>
      </div>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={logoutAll}
        loading={loading}
        title="Sign out everywhere?"
        confirmLabel="Sign out all"
        description="You'll be signed out on every device, including this one."
      />
    </div>
  );
}
