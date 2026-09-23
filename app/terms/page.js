import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { Brand } from "@/components/layout/Brand";

export const metadata = { title: "Terms & responsible gambling" };

export default async function TermsPage() {
  const s = await getSettings();
  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-4">
          <Brand name={s.platformName} logoUrl={s.logoUrl} />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Terms & responsible gambling</h1>
        <p className="mt-2 text-sm text-slate-500">Replace this template with terms reviewed for your jurisdiction before launch.</p>
        <div className="card mt-8 space-y-6 p-6 text-sm leading-relaxed text-slate-700">
          <section>
            <h2 className="text-base font-semibold text-slate-900">1. Eligibility</h2>
            <p className="mt-2">You must be at least 18 years old (or the legal gambling age where you live) to create an account.</p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-slate-900">2. Nature of the service</h2>
            <p className="mt-2">
              {s.platformName} sells subscriptions to informational bet codes. We do not accept bets, hold wagers or guarantee outcomes. Any bets you place are made
              with third-party operators at your own risk.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-slate-900">3. Subscriptions & payments</h2>
            <p className="mt-2">
              Subscriptions are prepaid for a fixed period and processed by Paystack. Access ends automatically at the end of the period unless renewed. Access
              to each bet code depends on the access level of your active plan.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-slate-900">4. Acceptable use</h2>
            <p className="mt-2">Accounts are personal. Sharing, reselling or redistributing bet codes may lead to suspension without refund.</p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-slate-900">5. Responsible gambling</h2>
            <p className="mt-2">
              Only stake what you can afford to lose, set limits, and never chase losses. If gambling stops being fun, take a break and reach out to a local
              support organisation.
            </p>
          </section>
        </div>
        <Link href="/" className="mt-8 inline-block text-sm font-medium text-brand-700 hover:underline">
          ← Back to home
        </Link>
      </main>
    </div>
  );
}
