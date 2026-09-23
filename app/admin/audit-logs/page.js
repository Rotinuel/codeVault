import { requireStaffPage } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/Primitives";
import { AuditLogTable } from "@/components/admin/AuditLogTable";

export const metadata = { title: "Audit logs" };

export default async function AdminAuditLogsPage() {
  await requireStaffPage(PERMISSIONS.AUDIT_VIEW);
  return (
    <>
      <PageHeader eyebrow="Security" title="Audit logs" description="Every important administrative action, with the actor, IP address and user agent." />
      <AuditLogTable />
    </>
  );
}
