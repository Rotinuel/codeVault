import { ForgotPasswordForm } from "@/components/auth/AuthForms";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Reset your password</h1>
      <p className="mt-1 mb-8 text-sm text-slate-500">Enter your account email and we&apos;ll send a secure reset link to your WhatsApp number.</p>
      <ForgotPasswordForm />
    </>
  );
}
