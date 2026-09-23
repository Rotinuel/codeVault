import { requireStaffPage } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/Primitives";
import { CategoriesManager } from "@/components/admin/CategoriesManager";

export const metadata = { title: "Categories" };

export default async function AdminCategoriesPage() {
  const { permissions } = await requireStaffPage(PERMISSIONS.BETCODES_VIEW);
  const canManage = permissions.includes(PERMISSIONS.CATEGORIES_MANAGE);
  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Categories"
        description={canManage ? "Organise bet codes and control which tabs subscribers see." : "Read-only: ask a Super Admin for category permissions."}
      />
      <CategoriesManager canManage={canManage} />
    </>
  );
}
