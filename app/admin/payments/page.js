import { requireStaffPage } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/Primitives";
import { PaymentsTable } from "@/components/admin/PaymentsTable";

export const metadata = { title: "Payments" };

export default async function AdminPaymentsPage() {
  await requireStaffPage(PERMISSIONS.PAYMENTS_VIEW);
  return (
    <>
      <PageHeader eyebrow="Billing" title="Payments & transactions" description="All Paystack transactions. Only server-verified payments activate subscriptions." />
      <PaymentsTable />
    </>
  );
}
