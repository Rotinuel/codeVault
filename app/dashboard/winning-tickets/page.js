import { redirect } from "next/navigation";
import { requireUserPage, isStaff } from "@/lib/auth";
import { PageHeader } from "@/components/ui/Primitives";
import { WinningTicketsCenter } from "@/components/tickets/WinningTicketsCenter";

export const metadata = { title: "Winning tickets" };

export default async function WinningTicketsPage() {
  const user = await requireUserPage();
  if (isStaff(user)) redirect("/admin/winning-tickets");
  return (
    <>
      <PageHeader
        eyebrow="Rewards"
        title="Winning tickets"
        description="Share your wins. Every ticket our team verifies counts towards a discount on your next subscription."
      />
      <WinningTicketsCenter />
    </>
  );
}
