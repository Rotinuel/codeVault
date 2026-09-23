import { requireStaffPage } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/Primitives";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const metadata = { title: "System settings" };

export default async function AdminSettingsPage() {
  await requireStaffPage(PERMISSIONS.SETTINGS_MANAGE);
  return (
    <>
      <PageHeader eyebrow="Super admin" title="System settings" description="Branding, currency, notifications and bet code publishing defaults." />
      <SettingsForm />
    </>
  );
}
