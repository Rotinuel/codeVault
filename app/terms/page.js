import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { Brand } from "@/components/layout/Brand";
import { TermsContent } from "@/components/legal/TermsContent";
import { TERMS_VERSION } from "@/lib/constants";

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
        <p className="mt-2 text-sm text-slate-500">Version {TERMS_VERSION}. Have these terms reviewed by a Nigerian lawyer before launch.</p>
        <div className="card mt-8 p-6">
          <TermsContent platformName={s.platformName} />
        </div>
        <Link href="/" className="mt-8 inline-block text-sm font-medium text-brand-700 hover:underline">
          ← Back to home
        </Link>
      </main>
    </div>
  );
}
