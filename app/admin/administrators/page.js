import { requireStaffPage } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/Primitives";
import { AdministratorsManager } from "@/components/admin/AdministratorsManager";

export const metadata = { title: "Administrators" };

export default async function AdminAdministratorsPage() {
  const { user } = await requireStaffPage(PERMISSIONS.ADMINS_MANAGE);
  return (
    <>
      <PageHeader eyebrow="Super admin" title="Administrators" description="Staff accounts with access to the admin panel. At least one Super Admin must always remain." />
      <AdministratorsManager currentUserId={String(user._id)} />
    </>
  );
}
