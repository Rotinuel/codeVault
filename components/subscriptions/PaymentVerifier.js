"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CircleCheckBig, CircleX, Clock, LoaderCircle } from "lucide-react";
import { apiFetch } from "@/lib/client/api";
import { ButtonLink, Button } from "@/components/ui/Button";
import { formatCurrency, formatDate } from "@/lib/utils";

/**
 * Shown after Paystack redirects back. It asks OUR server to verify the
 * reference with Paystack; the query-string status from the redirect is never trusted.
 */
export function PaymentVerifier({ reference, cancelled }) {
  const router = useRouter();
  const [state, setState] = useState({ phase: "verifying" });
  const attempts = useRef(0);

  useEffect(() => {
    let timer;
    let active = true;
    async function verify() {
      attempts.current += 1;
      try {
        const q = new URLSearchParams({ reference, ...(cancelled ? { cancelled: "1" } : {}) });
        const data = await apiFetch(`/api/payments/verify?${q}`);
        if (!active) return;
        if (data.status === "SUCCESS") {
          setState({ phase: "success", data });
          router.refresh();
        } else if (["PENDING", "PROCESSING"].includes(data.status) && attempts.current < 6) {
          setState({ phase: "pending", data });
          timer = setTimeout(verify, 3000);
        } else if (["PENDING", "PROCESSING"].includes(data.status)) {
          setState({ phase: "pending-final", data });
        } else {
          setState({ phase: "failed", data });
        }
      } catch (e) {
        if (!active) return;
        if (attempts.current < 3 && e.status >= 500) {
          timer = setTimeout(verify, 3000);
        } else {
          setState({ phase: "error", message: e.message });
        }
      }
    }
    if (reference) verify();
    else setState({ phase: "error", message: "Missing payment reference." });
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [reference, cancelled, router]);

  const p = state.data?.payment;
  const sub = state.data?.subscription;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card mx-auto max-w-lg p-8 text-center">
      {state.phase === "verifying" || state.phase === "pending" ? (
        <>
          <LoaderCircle className="mx-auto size-12 animate-spin text-brand-600" aria-hidden="true" />
          <h1 className="mt-5 text-xl font-semibold text-slate-900">Confirming your payment…</h1>
          <p className="mt-2 text-sm text-slate-500">We&apos;re verifying this transaction directly with Paystack. This usually takes a few seconds.</p>
        </>
      ) : state.phase === "success" ? (
        <>
          <CircleCheckBig className="mx-auto size-14 text-brand-600" aria-hidden="true" />
          <h1 className="mt-5 text-xl font-semibold text-slate-900">Payment successful</h1>
          <p className="mt-2 text-sm text-slate-500">
            {sub ? (
              <>
                Your <strong className="text-slate-800">{sub.planName}</strong> plan is active until <strong className="text-slate-800">{formatDate(sub.endDate)}</strong>.
                {sub.creditDays > 0 && ` ${sub.creditDays} bonus day${sub.creditDays === 1 ? " was" : "s were"} added from your previous plan.`}
              </>
            ) : (
              "Your subscription is active."
            )}
          </p>
          {p && (
            <dl className="mt-6 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-left text-sm">
              <dt className="text-slate-500">Amount</dt>
              <dd className="text-right font-medium text-slate-900">{formatCurrency(p.amount, p.currency)}</dd>
              <dt className="text-slate-500">Reference</dt>
              <dd className="truncate text-right font-mono text-xs text-slate-700">{p.reference}</dd>
            </dl>
          )}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <ButtonLink href="/dashboard/betcodes">View bet codes</ButtonLink>
            <ButtonLink href="/dashboard/payments" variant="secondary">
              Payment history
            </ButtonLink>
          </div>
        </>
      ) : state.phase === "pending-final" ? (
        <>
          <Clock className="mx-auto size-14 text-amber-500" aria-hidden="true" />
          <h1 className="mt-5 text-xl font-semibold text-slate-900">Payment still processing</h1>
          <p className="mt-2 text-sm text-slate-500">Paystack hasn&apos;t confirmed this payment yet. We&apos;ll activate your plan automatically once it does, and notify you.</p>
          <div className="mt-6 flex justify-center gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                attempts.current = 0;
                setState({ phase: "verifying" });
                router.refresh();
                window.location.reload();
              }}
            >
              Check again
            </Button>
            <ButtonLink href="/dashboard">Go to dashboard</ButtonLink>
          </div>
        </>
      ) : (
        <>
          <CircleX className="mx-auto size-14 text-rose-500" aria-hidden="true" />
          <h1 className="mt-5 text-xl font-semibold text-slate-900">
            {state.data?.status === "CANCELLED" || state.data?.status === "ABANDONED" ? "Payment cancelled" : "Payment not completed"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">{state.message || p?.failureReason || "No money was taken for this attempt. You can try again at any time."}</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <ButtonLink href="/dashboard/subscription#plans">Try again</ButtonLink>
            <Link href="/dashboard" className="inline-flex h-10 items-center justify-center px-4 text-sm font-medium text-slate-600 hover:text-slate-900">
              Back to dashboard
            </Link>
          </div>
        </>
      )}
    </motion.div>
  );
}
