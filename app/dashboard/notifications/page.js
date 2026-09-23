import { requireUserPage } from "@/lib/auth";
import { PageHeader } from "@/components/ui/Primitives";
import { NotificationsList } from "@/components/dashboard/NotificationsList";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  await requireUserPage();
  return (
    <>
      <PageHeader eyebrow="Inbox" title="Notifications" description="Everything we've sent you, including bet code releases and payment receipts." />
      <NotificationsList />
    </>
  );
}
