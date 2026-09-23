import { requireStaffPage } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/Primitives";
import { SubscriptionsTable } from "@/components/admin/SubscriptionsTable";

export const metadata = { title: "Subscriptions" };

export default async function AdminSubscriptionsPage() {
  await requireStaffPage(PERMISSIONS.SUBSCRIPTIONS_VIEW);
  return (
    <>
      <PageHeader eyebrow="Billing" title="Subscriptions" description="Every subscription period across all clients. Expired periods are detected automatically." />
      <SubscriptionsTable />
    </>
  );
}
