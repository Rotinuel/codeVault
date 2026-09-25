import { RegisterForm } from "@/components/auth/AuthForms";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Create account" };

export default async function RegisterPage() {
  const settings = await getSettings();
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Create your account</h1>
      <p className="mt-1 mb-8 text-sm text-slate-500">It takes less than a minute. We&apos;ll email you a code to confirm your address.</p>
      <RegisterForm platformName={settings.platformName} />
    </>
  );
}
