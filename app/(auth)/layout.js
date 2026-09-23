import { BadgeCheck, BellRing, ShieldCheck } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { Brand } from "@/components/layout/Brand";

export default async function AuthLayout({ children }) {
  const settings = await getSettings();
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,560px)]">
      <aside className="relative hidden overflow-hidden bg-ink-950 p-12 text-white lg:flex lg:flex-col">
        <div className="grid-bg absolute inset-0" aria-hidden="true" />
        <div className="absolute -left-24 top-1/3 size-96 rounded-full bg-brand-500/20 blur-3xl" aria-hidden="true" />
        <div className="relative">
          <Brand name={settings.platformName} logoUrl={settings.logoUrl} dark />
        </div>
        <div className="relative mt-auto max-w-lg">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">{settings.tagline}</h2>
          <ul className="mt-8 space-y-4 text-sm text-slate-300">
            <li className="flex gap-3">
              <BadgeCheck className="size-5 shrink-0 text-brand-400" aria-hidden="true" /> Codes released on a schedule, straight to your dashboard.
            </li>
            <li className="flex gap-3">
              <BellRing className="size-5 shrink-0 text-brand-400" aria-hidden="true" /> Instant WhatsApp alerts for every release on your plan.
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="size-5 shrink-0 text-brand-400" aria-hidden="true" /> Secure Paystack payments, verified server-side.
            </li>
          </ul>
          <p className="mt-12 text-xs text-slate-500">18+ only. Please gamble responsibly.</p>
        </div>
      </aside>
      <main className="flex flex-col px-5 py-8 sm:px-10">
        <div className="lg:hidden">
          <Brand name={settings.platformName} logoUrl={settings.logoUrl} />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}
