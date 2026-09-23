import { requireStaffPage } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/Primitives";
import { RolesManager } from "@/components/admin/RolesManager";

export const metadata = { title: "Roles & permissions" };

export default async function AdminRolesPage() {
  await requireStaffPage(PERMISSIONS.ROLES_MANAGE);
  return (
    <>
      <PageHeader eyebrow="Super admin" title="Roles & permissions" description="Control what Admin accounts can do. Assign roles from the Users or Administrators pages." />
      <RolesManager />
    </>
  );
}
