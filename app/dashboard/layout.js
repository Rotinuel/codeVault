import { requireUserPage, isStaff } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getAccessContext, serializeSubscription } from "@/lib/services/subscriptions";
import { AppShell } from "@/components/layout/AppShell";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: "dashboard", exact: true },
  { href: "/dashboard/betcodes", label: "Bet Codes", icon: "ticket" },
  { href: "/dashboard/subscription", label: "Subscription", icon: "crown" },
  { href: "/dashboard/payments", label: "Payments", icon: "receipt" },
  { href: "/dashboard/winning-tickets", label: "Winning Tickets", icon: "trophy" },
  { href: "/dashboard/notifications", label: "Notifications", icon: "bell" },
  { href: "/dashboard/profile", label: "Profile", icon: "user" },
];

export default async function DashboardLayout({ children }) {
  const user = await requireUserPage();
  const [settings, ctx] = await Promise.all([getSettings(), getAccessContext(user)]);
  const sub = serializeSubscription(ctx.subscription);
  return (
    <AppShell
      variant="user"
      nav={NAV}
      user={{ name: user.name, email: user.email, role: user.role }}
      brand={{ name: settings.platformName, logoUrl: settings.logoUrl }}
      subscription={
        sub
          ? { planName: sub.planName, daysRemaining: sub.daysRemaining }
          : ctx.isStaff
            ? { planName: "Staff · full access", daysRemaining: null }
            : null
      }
      switchLink={isStaff(user) ? { href: "/admin", label: "Open admin panel" } : null}
    >
      {children}
    </AppShell>
  );
}
