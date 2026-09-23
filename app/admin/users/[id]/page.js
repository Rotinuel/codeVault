import { notFound } from "next/navigation";
import { requireStaffPage } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { UserDetail } from "@/components/admin/UserDetail";

export const metadata = { title: "User details" };

export default async function AdminUserDetailPage({ params }) {
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/i.test(id)) notFound();
  const { user, permissions } = await requireStaffPage(PERMISSIONS.USERS_VIEW);
  return (
    <UserDetail
      id={id}
      isSuper={user.role === "SUPER_ADMIN"}
      canManage={permissions.includes(PERMISSIONS.USERS_MANAGE)}
      canManageSubscriptions={permissions.includes(PERMISSIONS.SUBSCRIPTIONS_MANAGE)}
    />
  );
}
