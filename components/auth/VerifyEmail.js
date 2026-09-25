"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheckBig, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/client/api";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Primitives";
import { cn } from "@/lib/utils";

const LENGTH = 6;

/** Six single-digit boxes; paste or SMS/email autofill fills all of them. */
function CodeInput({ value, onChange, onComplete, error, disabled }) {
  const refs = useRef([]);
  const digits = Array.from({ length: LENGTH }, (_, i) => value[i] || "");

  function setAt(i, d) {
    const next = (value.slice(0, i) + d + value.slice(i + 1)).replace(/\D/g, "").slice(0, LENGTH);
    onChange(next);
    return next;
  }

  function handleInput(i, e) {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) return;
    if (raw.length > 1) {
      // Paste / autofill of the whole code.
      const next = (value.slice(0, i) + raw).slice(0, LENGTH);
      onChange(next);
      refs.current[Math.min(next.length, LENGTH - 1)]?.focus();
      if (next.length === LENGTH) onComplete(next);
      return;
    }
    const next = setAt(i, raw);
    if (i < LENGTH - 1) refs.current[i + 1]?.focus();
    if (next.length === LENGTH) onComplete(next);
  }

  function handleKey(i, e) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i]) onChange(value.slice(0, i) + value.slice(i + 1));
      else if (i > 0) {
        onChange(value.slice(0, i - 1) + value.slice(i));
        refs.current[i - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    else if (e.key === "ArrowRight" && i < LENGTH - 1) refs.current[i + 1]?.focus();
  }

  return (
    <div className="flex justify-between gap-2" role="group" aria-label="6-digit verification code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          value={d}
          onChange={(e) => handleInput(i, e)}
          onKeyDown={(e) => handleKey(i, e)}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={i === 0 ? LENGTH : 1}
          disabled={disabled}
          autoFocus={i === 0}
          aria-label={`Digit ${i + 1}`}
          className={cn(
            "h-14 w-full min-w-0 rounded-xl border bg-white text-center text-2xl font-semibold tabular-nums text-slate-900 shadow-sm focus:outline-none focus:ring-4",
            error ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/15" : "border-slate-300 focus:border-brand-500 focus:ring-brand-500/15"
          )}
        />
      ))}
    </div>
  );
}

export function VerifyEmailForm({ email, initialWait = 0, autoSend = false }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [wait, setWait] = useState(initialWait);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setInterval(() => setWait((w) => Math.max(0, w - 1)), 1000);
    return () => clearInterval(t);
  }, [wait]);

  async function resend({ quiet = false } = {}) {
    setSending(true);
    try {
      const res = await apiFetch("/api/auth/verify-email/resend", { method: "POST" });
      if (res.alreadyVerified) {
        router.replace(res.redirectTo || "/dashboard");
        return;
      }
      setWait(res.cooldown || 60);
      setCode("");
      setError("");
      if (!quiet) toast.success(`New code sent to ${email}`);
    } catch (e) {
      if (e.status === 429 && e.payload?.retryAfter) setWait(Number(e.payload.retryAfter));
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  }

  // Account created but the first email never went out: send it now.
  const autoSent = useRef(false);
  useEffect(() => {
    if (autoSend && !autoSent.current) {
      autoSent.current = true;
      resend({ quiet: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSend]);

  async function verify(value = code) {
    if (value.length !== LENGTH) {
      setError("Enter all 6 digits");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await apiFetch("/api/auth/verify-email", { method: "POST", body: { code: value } });
      toast.success("Email verified! Welcome aboard.");
      router.replace(res.redirectTo || "/dashboard/subscription");
      router.refresh();
    } catch (e) {
      setError(e.errors?.code || e.message);
      setCode("");
      setBusy(false);
    }
  }

  async function signOut() {
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/register");
    router.refresh();
  }

  return (
    <div>
      <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
        <MailCheck className="size-6" aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">Check your email</h1>
      <p className="mt-1 mb-8 text-sm text-slate-500">
        We sent a 6-digit code to <strong className="text-slate-800">{email}</strong>. Enter it below, or tap the button in the email.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          verify();
        }}
        className="space-y-5"
        noValidate
      >
        <CodeInput value={code} onChange={setCode} onComplete={verify} error={error} disabled={busy} />
        {error && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-rose-600" role="alert">
            <CircleAlert className="size-4" aria-hidden="true" /> {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={code.length !== LENGTH}>
          Verify email
        </Button>
      </form>

      <div className="mt-6 space-y-3 text-center text-sm text-slate-500">
        <p>
          Didn&apos;t get it? Check spam, or{" "}
          <button
            type="button"
            onClick={() => resend()}
            disabled={wait > 0 || sending}
            className="font-medium text-brand-700 hover:text-brand-800 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            {sending ? "sending…" : wait > 0 ? `resend in ${wait}s` : "send a new code"}
          </button>
          .
        </p>
        <p>
          Wrong email?{" "}
          <button type="button" onClick={signOut} className="font-medium text-brand-700 hover:text-brand-800">
            Sign out and register again
          </button>
        </p>
      </div>
    </div>
  );
}

/** Landing page for the link in the email. */
export function VerifyLink({ token }) {
  const router = useRouter();
  const [state, setState] = useState({ status: "loading" });
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    apiFetch("/api/auth/verify-email", { method: "POST", body: { token } })
      .then((res) => {
        setState({ status: "ok", redirectTo: res.redirectTo });
        if (res.redirectTo?.startsWith("/dashboard")) {
          setTimeout(() => {
            router.replace(res.redirectTo);
            router.refresh();
          }, 1200);
        }
      })
      .catch((e) => setState({ status: "error", message: e.message }));
  }, [token, router]);

  if (state.status === "loading") {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-slate-500">
        <Spinner />
        Verifying your email…
      </div>
    );
  }
  if (state.status === "ok") {
    return (
      <div className="text-center">
        <CircleCheckBig className="mx-auto size-12 text-brand-600" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">Email verified</h1>
        <p className="mt-2 text-sm text-slate-500">
          {state.redirectTo?.startsWith("/dashboard") ? "Taking you to your dashboard…" : "Your account is ready. Sign in to choose a plan."}
        </p>
        {!state.redirectTo?.startsWith("/dashboard") && (
          <ButtonLink href="/login?verified=1" size="lg" className="mt-6 w-full">
            Sign in
          </ButtonLink>
        )}
      </div>
    );
  }
  return (
    <div className="text-center">
      <CircleAlert className="mx-auto size-12 text-amber-500" aria-hidden="true" />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">Link not valid</h1>
      <p className="mt-2 text-sm text-slate-500">{state.message}</p>
      <ButtonLink href="/verify-email" size="lg" className="mt-6 w-full">
        Get a new code
      </ButtonLink>
      <p className="mt-4 text-sm text-slate-500">
        Already verified?{" "}
        <Link href="/login" className="font-medium text-brand-700 hover:text-brand-800">
          Sign in
        </Link>
      </p>
    </div>
  );
}
