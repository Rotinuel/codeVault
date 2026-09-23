import { requireStaffPage } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui/Primitives";
import { PlansManager } from "@/components/admin/PlansManager";

export const metadata = { title: "Subscription plans" };

export default async function AdminPlansPage() {
  await requireStaffPage(PERMISSIONS.PLANS_MANAGE);
  const settings = await getSettings();
  return (
    <>
      <PageHeader
        eyebrow="Super admin"
        title="Subscription plans"
        description="Prices, durations and access levels live in the database — add Basic, Standard, Premium, VIP or any future plan without code changes."
      />
      <PlansManager defaultDuration={settings.defaultSubscriptionDurationDays} currency={settings.currency} />
    </>
  );
}
