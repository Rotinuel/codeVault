import { redirect } from "next/navigation";
import { getAuthState } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { STAFF_ROLES } from "@/lib/constants";
import { maskEmail, resendWaitSeconds } from "@/lib/verification-codes";
import { VerifyEmailForm, VerifyLink } from "@/components/auth/VerifyEmail";

export const metadata = { title: "Verify your email" };

export default async function VerifyEmailPage({ searchParams }) {
  const sp = await searchParams;
  const token = typeof sp?.token === "string" ? sp.token : "";

  // Opened from the email link: verify it (works in any browser, signed in or not).
  if (token) return <VerifyLink token={token} />;

  const { user } = await getAuthState();
  if (!user) redirect("/login?next=/verify-email");
  if (user.emailVerified !== false) redirect(STAFF_ROLES.includes(user.role) ? "/admin" : "/dashboard");

  await connectDB();
  const doc = await User.findById(user._id).select("+emailVerification").lean();
  const wait = resendWaitSeconds(doc?.emailVerification?.sentAt);
  const neverSent = !doc?.emailVerification?.sentAt;

  return <VerifyEmailForm email={maskEmail(user.email)} initialWait={wait} autoSend={neverSent} />;
}
