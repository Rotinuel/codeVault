import { requireStaffPage } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/Primitives";
import { AnalyticsDashboard } from "@/components/admin/AnalyticsDashboard";

export const metadata = { title: "Analytics" };

export default async function AdminAnalyticsPage() {
  await requireStaffPage(PERMISSIONS.ANALYTICS_BASIC);
  return (
    <>
      <PageHeader eyebrow="Insights" title="Analytics" description="Users, subscribers, revenue and bet code engagement." />
      <AnalyticsDashboard />
    </>
  );
}
