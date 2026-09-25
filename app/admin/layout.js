import { requireStaffPage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PERMISSIONS as P } from "@/lib/permissions";
import { AppShell } from "@/components/layout/AppShell";

const ITEMS = [
  { href: "/admin", label: "Overview", icon: "dashboard", exact: true },
  { href: "/admin/users", label: "Users", icon: "users", perm: P.USERS_VIEW },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: "crown", perm: P.SUBSCRIPTIONS_VIEW },
  { href: "/admin/payments", label: "Payments", icon: "card", perm: P.PAYMENTS_VIEW },
  { href: "/admin/betcodes", label: "Bet Codes", icon: "ticket", perm: P.BETCODES_VIEW },
  { href: "/admin/categories", label: "Categories", icon: "tags", perm: P.BETCODES_VIEW },
  { href: "/admin/notifications", label: "Notifications", icon: "bell", perm: P.NOTIFICATIONS_SEND },
  { href: "/admin/analytics", label: "Analytics", icon: "chart", perm: P.ANALYTICS_BASIC },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: "scroll", perm: P.AUDIT_VIEW },
];

const SUPER_ITEMS = [
  { href: "/admin/winning-tickets", label: "Winning Tickets", icon: "trophy", perm: P.WINNING_TICKETS_REVIEW },
  { href: "/admin/plans", label: "Subscription Plans", icon: "layers", perm: P.PLANS_MANAGE },
  { href: "/admin/administrators", label: "Administrators", icon: "userCog", perm: P.ADMINS_MANAGE },
  { href: "/admin/roles", label: "Roles & Permissions", icon: "key", perm: P.ROLES_MANAGE },
  { href: "/admin/settings", label: "System Settings", icon: "settings", perm: P.SETTINGS_MANAGE },
];

export default async function AdminLayout({ children }) {
  const { user, permissions } = await requireStaffPage();
  const settings = await getSettings();
  const allowed = (i) => !i.perm || permissions.includes(i.perm);
  const superItems = SUPER_ITEMS.filter(allowed);
  const nav = [...ITEMS.filter(allowed), ...(superItems.length ? [{ section: "Super admin" }, ...superItems] : [])];

  return (
    <AppShell
      variant="admin"
      nav={nav}
      user={{ name: user.name, email: user.email, role: user.role }}
      brand={{ name: settings.platformName, logoUrl: settings.logoUrl }}
      switchLink={{ href: "/dashboard", label: "View client dashboard" }}
    >
      {children}
    </AppShell>
  );
}
