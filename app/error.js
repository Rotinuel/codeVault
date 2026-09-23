"use client";

import { useEffect } from "react";
import { CircleAlert } from "lucide-react";

export default function GlobalRouteError({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="grid min-h-dvh place-items-center bg-slate-50 px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-rose-50 text-rose-600">
          <CircleAlert className="size-7" aria-hidden="true" />
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-slate-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-500">An unexpected error occurred. Please try again in a moment.</p>
        {error?.digest && <p className="mt-2 font-mono text-xs text-slate-400">Ref: {error.digest}</p>}
        <button type="button" onClick={reset} className="mt-6 inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
          Try again
        </button>
      </div>
    </div>
  );
}
