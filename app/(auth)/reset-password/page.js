import { ResetPasswordForm } from "@/components/auth/AuthForms";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }) {
  const sp = await searchParams;
  const token = typeof sp?.token === "string" && /^[a-f0-9]{64}$/i.test(sp.token) ? sp.token : "";
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Choose a new password</h1>
      <p className="mt-1 mb-8 text-sm text-slate-500">After updating, every existing session is signed out for your security.</p>
      <ResetPasswordForm token={token} />
    </>
  );
}
