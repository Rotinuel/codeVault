import { requireUserPage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Brand } from "@/components/layout/Brand";
import { PaymentVerifier } from "@/components/subscriptions/PaymentVerifier";

export const metadata = { title: "Payment status", robots: { index: false } };

// Paystack redirects here with ?reference=...&trxref=... (and our cancel_action adds &cancelled=1).
export default async function PaymentCallbackPage({ searchParams }) {
  const sp = await searchParams;
  await requireUserPage();
  const settings = await getSettings();
  const raw = sp?.reference || sp?.trxref || "";
  const reference = typeof raw === "string" && /^[A-Za-z0-9_\-.=]{6,100}$/.test(raw) ? raw : "";
  return (
    <div className="min-h-dvh bg-slate-50 px-4 py-10">
      <div className="mx-auto mb-10 flex max-w-lg justify-center">
        <Brand name={settings.platformName} logoUrl={settings.logoUrl} href="/dashboard" />
      </div>
      <PaymentVerifier reference={reference} cancelled={sp?.cancelled === "1"} />
    </div>
  );
}
