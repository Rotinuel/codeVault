import { requireStaffPage } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/Primitives";
import { WinningTicketsManager } from "@/components/admin/WinningTicketsManager";

export const metadata = { title: "Winning tickets" };

export default async function AdminWinningTicketsPage() {
  await requireStaffPage(PERMISSIONS.WINNING_TICKETS_REVIEW);
  return (
    <>
      <PageHeader
        eyebrow="Super admin"
        title="Winning tickets"
        description="Verify tickets uploaded by clients, choose which appear on the homepage, and set the monthly upload target and the discount it earns."
      />
      <WinningTicketsManager />
    </>
  );
}
