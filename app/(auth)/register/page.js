import { RegisterForm } from "@/components/auth/AuthForms";

export const metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Create your account</h1>
      <p className="mt-1 mb-8 text-sm text-slate-500">It takes less than a minute. Choose a plan after signing up.</p>
      <RegisterForm />
    </>
  );
}
