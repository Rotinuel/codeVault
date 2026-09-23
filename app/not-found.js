import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-slate-50 px-4">
      <div className="text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-700">
          <Compass className="size-7" aria-hidden="true" />
        </div>
        <p className="mt-6 text-sm font-semibold text-brand-700">404</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Page not found</h1>
        <p className="mt-2 text-sm text-slate-500">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/" className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
            Go home
          </Link>
          <Link href="/dashboard" className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
