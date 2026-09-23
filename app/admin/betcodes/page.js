import { Suspense } from "react";
import { requireStaffPage } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { PageHeader, Skeleton } from "@/components/ui/Primitives";
import { BetCodeManager } from "@/components/admin/BetCodeManager";

export const metadata = { title: "Bet codes" };

export default async function AdminBetCodesPage() {
  const { permissions } = await requireStaffPage(PERMISSIONS.BETCODES_VIEW);
  const settings = await getSettings();
  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Bet codes"
        description={`Create, schedule and publish codes. Times are shown in ${settings.timezone}. Access is enforced on the server for every request.`}
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <BetCodeManager permissions={permissions} timezone={settings.timezone} notifyDefault={settings.betCodes.notifyOnPublishDefault} />
      </Suspense>
    </>
  );
}
