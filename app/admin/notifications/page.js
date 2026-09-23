import { requireStaffPage } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/Primitives";
import { NotificationsCenter } from "@/components/admin/NotificationsCenter";

export const metadata = { title: "Notifications" };

export default async function AdminNotificationsPage() {
  await requireStaffPage(PERMISSIONS.NOTIFICATIONS_SEND);
  return (
    <>
      <PageHeader
        eyebrow="Engagement"
        title="Notifications"
        description="Bet code releases notify entitled subscribers automatically. Use this page for announcements and WhatsApp broadcasts."
      />
      <NotificationsCenter />
    </>
  );
}
