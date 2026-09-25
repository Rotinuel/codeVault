"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleCheckBig, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/client/api";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Form";
import { TermsModal, TermsStatus } from "./TermsGate";

function PasswordField({ id, label, value, onChange, error, autoComplete, hint }) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint}>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          error={error}
          autoComplete={autoComplete}
          className="pr-10"
          required
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600" aria-label={show ? "Hide password" : "Show password"}>
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </Field>
  );
}

function safeNext(next) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "";
}

export function LoginForm({ next }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    try {
      const n = safeNext(next);
      const data = await apiFetch(`/api/auth/login${n ? `?next=${encodeURIComponent(n)}` : ""}`, { method: "POST", body: { email, password } });
      if (data.needsVerification) toast.message("Please verify your email to continue.");
      else toast.success(`Welcome back, ${data.user.name.split(" ")[0]}!`);
      router.replace(data.redirectTo || "/dashboard");
      router.refresh();
    } catch (err) {
      setErrors(err.errors || { password: err.message });
      if (!err.errors) toast.error(err.message);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <Field label="Email" htmlFor="email" error={errors.email}>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} autoComplete="email" required autoFocus />
      </Field>
      <PasswordField id="password" label="Password" value={password} onChange={setPassword} error={errors.password} autoComplete="current-password" />
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm font-medium text-brand-700 hover:text-brand-800">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" className="w-full" size="lg" loading={loading}>
        Sign in
      </Button>
      <p className="text-center text-sm text-slate-500">
        New here?{" "}
        <Link href="/register" className="font-medium text-brand-700 hover:text-brand-800">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm({ platformName = "CodeVault" }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", acceptTerms: false });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  // The terms open as soon as the sign-up page loads.
  useEffect(() => {
    const t = setTimeout(() => setTermsOpen(true), 250);
    return () => clearTimeout(t);
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!form.acceptTerms) {
      setErrors({ acceptTerms: "Please read and accept the terms first" });
      setTermsOpen(true);
      return;
    }
    setLoading(true);
    setErrors({});
    try {
      const data = await apiFetch("/api/auth/register", { method: "POST", body: form });
      if (data.emailSent === false) toast.warning("Account created, but we couldn't send the email. Tap \"Resend\" on the next screen.");
      else toast.success("Account created! Check your email for a 6-digit code.");
      router.replace(data.redirectTo || "/verify-email");
      router.refresh();
    } catch (err) {
      setErrors(err.errors || {});
      toast.error(err.message);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Full name" htmlFor="name" error={errors.name}>
        <Input id="name" value={form.name} onChange={(e) => set("name")(e.target.value)} error={errors.name} autoComplete="name" required autoFocus />
      </Field>
      <Field label="Email" htmlFor="email" error={errors.email}>
        <Input id="email" type="email" value={form.email} onChange={(e) => set("email")(e.target.value)} error={errors.email} autoComplete="email" required />
      </Field>
      <Field label="WhatsApp number" htmlFor="phone" error={errors.phone} hint="We send release alerts here. Include your country code.">
        <Input id="phone" type="tel" placeholder="+234 801 234 5678" value={form.phone} onChange={(e) => set("phone")(e.target.value)} error={errors.phone} autoComplete="tel" required />
      </Field>
      <PasswordField id="password" label="Password" value={form.password} onChange={set("password")} error={errors.password} autoComplete="new-password" hint="At least 8 characters, with letters and numbers." />
      <TermsStatus accepted={form.acceptTerms} onOpen={() => setTermsOpen(true)} error={errors.acceptTerms} />
      <Button type="submit" className="w-full" size="lg" loading={loading} disabled={!form.acceptTerms}>
        {form.acceptTerms ? "Create account" : "Accept the terms to continue"}
      </Button>
      <TermsModal
        open={termsOpen}
        platformName={platformName}
        onClose={() => setTermsOpen(false)}
        onAccept={() => {
          set("acceptTerms")(true);
          setErrors((x) => ({ ...x, acceptTerms: undefined }));
          setTermsOpen(false);
        }}
      />
      <p className="text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-700 hover:text-brand-800">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(null);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/api/auth/forgot-password", { method: "POST", body: { email } });
      setSent(email);
    } catch (err) {
      setError(err.errors?.email || err.message);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5 text-sm text-brand-900" role="status">
        <CircleCheckBig className="mb-2 size-6 text-brand-600" aria-hidden="true" />
        If an account exists for <strong>{sent}</strong>, a reset link has been sent to its WhatsApp number. The link expires in 30 minutes.
        <p className="mt-3 text-brand-800/80">No WhatsApp on your account? Contact support and an administrator can issue a reset link.</p>
        <Link href="/login" className="mt-4 inline-block font-medium text-brand-700 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <Field label="Email" htmlFor="email" error={error}>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} autoComplete="email" required autoFocus />
      </Field>
      <Button type="submit" className="w-full" size="lg" loading={loading}>
        Send reset link
      </Button>
      <p className="text-center text-sm text-slate-500">
        <Link href="/login" className="font-medium text-brand-700 hover:text-brand-800">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (password !== confirm) {
      setErrors({ confirm: "Passwords don't match" });
      return;
    }
    setLoading(true);
    setErrors({});
    try {
      const data = await apiFetch("/api/auth/reset-password", { method: "POST", body: { token, password } });
      toast.success("Password updated. Please sign in.");
      router.replace(data.redirectTo || "/login");
    } catch (err) {
      setErrors(err.errors?.password ? err.errors : { password: err.message });
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
        This reset link is missing its token. <Link href="/forgot-password" className="font-medium underline">Request a new link</Link>.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <PasswordField id="password" label="New password" value={password} onChange={setPassword} error={errors.password} autoComplete="new-password" hint="At least 8 characters, with letters and numbers." />
      <PasswordField id="confirm" label="Confirm password" value={confirm} onChange={setConfirm} error={errors.confirm} autoComplete="new-password" />
      <Button type="submit" className="w-full" size="lg" loading={loading}>
        Update password
      </Button>
    </form>
  );
}
