import { requireUserPage } from "@/lib/auth";
import { publicUser } from "@/lib/serializers";
import { PageHeader } from "@/components/ui/Primitives";
import { ChangePasswordForm, ProfileForm, SessionsCard } from "@/components/dashboard/ProfileForms";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUserPage();
  return (
    <>
      <PageHeader eyebrow="Account" title="Profile & security" description="Manage your details, notifications and password." />
      <div className="space-y-6">
        <ProfileForm user={publicUser(user)} />
        <ChangePasswordForm />
        <SessionsCard />
      </div>
    </>
  );
}
