"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, CircleCheck, FileText } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TermsContent } from "@/components/legal/TermsContent";
import { cn } from "@/lib/utils";

/**
 * Terms & conditions dialog. "I agree" only becomes available once the reader
 * has scrolled to the end of the text.
 */
export function TermsModal({ open, onClose, onAccept, platformName }) {
  const box = useRef(null);
  const [progress, setProgress] = useState(0);
  const [reachedEnd, setReachedEnd] = useState(false);

  const measure = useCallback(() => {
    const el = box.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    const pct = max <= 0 ? 100 : Math.min(100, Math.round((el.scrollTop / max) * 100));
    setProgress((p) => Math.max(p, pct));
    if (max <= 0 || el.scrollTop >= max - 24) setReachedEnd(true);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    setProgress(0);
    setReachedEnd(false);
    // Wait for the dialog to render/animate before measuring.
    const t = setTimeout(measure, 350);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
    };
  }, [open, measure]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Terms & conditions"
      description="Please read to the end. You must be 18 or older to join."
      closeOnBackdrop={false}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Not now
          </Button>
          <Button onClick={onAccept} disabled={!reachedEnd} aria-describedby="terms-scroll-hint">
            {reachedEnd ? "I'm 18+ and I agree" : "Scroll to the end to agree"}
          </Button>
        </>
      }
    >
      <div className="-mx-5 -my-5">
        <div className="sticky top-0 z-10 h-1 bg-slate-100" aria-hidden="true">
          <div className="h-full bg-brand-600 transition-[width] duration-150" style={{ width: `${progress}%` }} />
        </div>
        <div
          ref={box}
          onScroll={measure}
          tabIndex={0}
          className="scrollbar-thin max-h-[55vh] overflow-y-auto px-5 py-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/40"
          aria-label="Terms and conditions text"
        >
          <TermsContent platformName={platformName} />
          <p className="mt-8 rounded-xl bg-slate-50 p-4 text-center text-sm font-medium text-slate-700">
            <CircleCheck className="mx-auto mb-1 size-5 text-brand-600" aria-hidden="true" />
            You&apos;ve reached the end of the terms.
          </p>
        </div>
        <p id="terms-scroll-hint" className={cn("flex items-center justify-center gap-1.5 border-t border-slate-100 px-5 py-2 text-xs", reachedEnd ? "text-brand-700" : "text-slate-500")}>
          {reachedEnd ? (
            <>
              <CircleCheck className="size-3.5" aria-hidden="true" /> Thanks for reading. You can now agree.
            </>
          ) : (
            <>
              <ArrowDown className="size-3.5 animate-bounce" aria-hidden="true" /> Scroll down to read everything ({progress}%)
            </>
          )}
        </p>
      </div>
    </Modal>
  );
}

/** Status row on the sign-up form: opens the terms and shows whether they were accepted. */
export function TermsStatus({ accepted, onOpen, error }) {
  return (
    <div>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors",
          accepted ? "border-brand-200 bg-brand-50/60" : error ? "border-rose-300 bg-rose-50/50" : "border-slate-300 hover:border-brand-400 hover:bg-slate-50"
        )}
      >
        {accepted ? (
          <CircleCheck className="size-5 shrink-0 text-brand-600" aria-hidden="true" />
        ) : (
          <FileText className="size-5 shrink-0 text-slate-400" aria-hidden="true" />
        )}
        <span className="flex-1">
          <span className="block font-medium text-slate-900">{accepted ? "Terms accepted" : "Read the terms & conditions"}</span>
          <span className="block text-xs text-slate-500">
            {accepted ? "You're 18+ and agreed to the terms & responsible gambling policy." : "Required. Read to the end to enable sign-up."}
          </span>
        </span>
        <span className="text-xs font-medium text-brand-700">{accepted ? "Read again" : "Open"}</span>
      </button>
      {error && <p className="mt-1.5 text-xs font-medium text-rose-600" role="alert">{error}</p>}
    </div>
  );
}
