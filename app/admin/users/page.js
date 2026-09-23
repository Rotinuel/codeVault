import { requireStaffPage } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/Primitives";
import { UsersManager } from "@/components/admin/UsersManager";

export const metadata = { title: "Users" };

export default async function AdminUsersPage() {
  const { user, permissions } = await requireStaffPage(PERMISSIONS.USERS_VIEW);
  const isSuper = user.role === "SUPER_ADMIN";
  return (
    <>
      <PageHeader
        eyebrow="Users"
        title="Users & subscribers"
        description={isSuper ? "All accounts on the platform, including staff." : "Client accounts. Staff accounts are managed by a Super Admin."}
      />
      <UsersManager isSuper={isSuper} canManage={permissions.includes(PERMISSIONS.USERS_MANAGE)} />
    </>
  );
}
