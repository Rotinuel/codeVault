import { requireUserPage } from "@/lib/auth";
import { PageHeader } from "@/components/ui/Primitives";
import { PaymentHistory } from "@/components/dashboard/PaymentHistory";

export const metadata = { title: "Payments" };

export default async function PaymentsPage() {
  await requireUserPage();
  return (
    <>
      <PageHeader eyebrow="Billing" title="Payment history" description="Every payment is verified directly with Paystack before your plan is activated." />
      <PaymentHistory />
    </>
  );
}
