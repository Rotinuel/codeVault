import { CircleAlert, CircleCheckBig } from "lucide-react";
import { LoginForm } from "@/components/auth/AuthForms";

export const metadata = { title: "Sign in" };

const NOTICES = {
  suspended: { tone: "warn", text: "Your account is suspended. Contact support for help." },
  banned: { tone: "warn", text: "This account has been banned." },
  expired: { tone: "warn", text: "Your session expired. Please sign in again." },
  reset: { tone: "ok", text: "Password updated. Sign in with your new password." },
};

export default async function LoginPage({ searchParams }) {
  const sp = await searchParams;
  const notice = sp?.blocked ? NOTICES[sp.blocked] : sp?.expired ? NOTICES.expired : sp?.reset ? NOTICES.reset : null;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Sign in</h1>
      <p className="mt-1 mb-8 text-sm text-slate-500">Access your bet codes and subscription.</p>
      {notice && (
        <div
          role="status"
          className={`mb-6 flex gap-2.5 rounded-xl p-3.5 text-sm ${notice.tone === "ok" ? "bg-brand-50 text-brand-900" : "bg-amber-50 text-amber-900"}`}
        >
          {notice.tone === "ok" ? <CircleCheckBig className="size-5 shrink-0" aria-hidden="true" /> : <CircleAlert className="size-5 shrink-0" aria-hidden="true" />}
          {notice.text}
        </div>
      )}
      <LoginForm next={typeof sp?.next === "string" ? sp.next : ""} />
    </>
  );
}
