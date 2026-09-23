"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeftRight, Crown, LogOut, Menu as MenuIcon, User, X } from "lucide-react";
import { toast } from "sonner";
import { Brand } from "./Brand";
import { Icon } from "./icons";
import { NotificationBell } from "./NotificationBell";
import { Avatar } from "@/components/ui/Primitives";
import { Menu, MenuDivider, MenuItem } from "@/components/ui/Menu";
import { apiFetch } from "@/lib/client/api";
import { cn } from "@/lib/utils";

function NavList({ nav, pathname, onNavigate, dark }) {
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {nav.map((item) =>
        item.section ? (
          <p key={item.section} className={cn("mb-1 mt-5 px-3 text-[11px] font-semibold uppercase tracking-wider", dark ? "text-slate-500" : "text-slate-400")}>
            {item.section}
          </p>
        ) : (
          <NavLink key={item.href} item={item} active={item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)} onNavigate={onNavigate} dark={dark} />
        )
      )}
    </nav>
  );
}

function NavLink({ item, active, onNavigate, dark }) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        dark
          ? active
            ? "bg-white/10 text-white"
            : "text-slate-400 hover:bg-white/5 hover:text-white"
          : active
            ? "bg-brand-50 text-brand-800"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      )}
    >
      {active && <span className={cn("absolute inset-y-1.5 left-0 w-0.5 rounded-full", dark ? "bg-brand-400" : "bg-brand-600")} aria-hidden="true" />}
      <Icon name={item.icon} className="size-[18px] shrink-0" />
      <span className="truncate">{item.label}</span>
      {item.badge && <span className="ml-auto rounded-full bg-gold-400/20 px-1.5 py-0.5 text-[10px] font-semibold text-gold-400">{item.badge}</span>}
    </Link>
  );
}

/**
 * Shared dashboard chrome for the client area and admin panel.
 * Receives only serialisable props from the server layout.
 */
export function AppShell({ variant = "user", nav, user, brand, subscription, switchLink, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const dark = variant === "admin";

  useEffect(() => setMobileOpen(false), [pathname]);

  async function logout() {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* cookie is cleared server-side regardless */
    }
    toast.success("Signed out");
    router.replace("/login");
    router.refresh();
  }

  const sidebar = (
    <div className={cn("flex h-full flex-col", dark ? "bg-ink-950" : "bg-white")}>
      <div className="flex h-16 items-center px-5">
        <Brand name={brand.name} logoUrl={brand.logoUrl} href={dark ? "/admin" : "/dashboard"} dark={dark} />
        {dark && <span className="ml-2 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300">Admin</span>}
      </div>
      <div className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-4">
        <NavList nav={nav} pathname={pathname} dark={dark} onNavigate={() => setMobileOpen(false)} />
      </div>
      {!dark && subscription === null && (
        <div className="m-3 rounded-xl bg-linear-to-br from-ink-900 to-ink-800 p-4 text-white">
          <Crown className="size-5 text-gold-400" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold">Unlock bet codes</p>
          <p className="mt-1 text-xs text-slate-300">Subscribe to a plan to access daily releases.</p>
          <Link href="/dashboard/subscription" className="mt-3 inline-flex text-xs font-semibold text-brand-300 hover:text-brand-200">
            View plans →
          </Link>
        </div>
      )}
      {switchLink && (
        <div className={cn("border-t p-3", dark ? "border-white/10" : "border-slate-100")}>
          <Link
            href={switchLink.href}
            className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium", dark ? "text-slate-400 hover:bg-white/5 hover:text-white" : "text-slate-600 hover:bg-slate-100")}
          >
            <ArrowLeftRight className="size-4" aria-hidden="true" />
            {switchLink.label}
          </Link>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className={cn("fixed inset-y-0 left-0 z-30 hidden w-64 border-r lg:block", dark ? "border-white/5" : "border-slate-200")}>{sidebar}</aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div className="absolute inset-0 bg-slate-950/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} />
            <motion.aside
              className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-xl"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
            >
              {sidebar}
              <button type="button" onClick={() => setMobileOpen(false)} className={cn("absolute right-3 top-4 rounded-lg p-1.5", dark ? "text-slate-400 hover:bg-white/10" : "text-slate-500 hover:bg-slate-100")} aria-label="Close menu">
                <X className="size-5" />
              </button>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/85 px-4 backdrop-blur sm:px-6">
          <button type="button" onClick={() => setMobileOpen(true)} className="-ml-1 rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open menu">
            <MenuIcon className="size-5" />
          </button>
          <div className="lg:hidden">
            <Brand name={brand.name} logoUrl={brand.logoUrl} href={dark ? "/admin" : "/dashboard"} />
          </div>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {!dark && (
              <Link
                href="/dashboard/subscription"
                className={cn(
                  "hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset sm:inline-flex",
                  subscription ? "bg-brand-50 text-brand-800 ring-brand-200" : "bg-amber-50 text-amber-800 ring-amber-200"
                )}
              >
                <Crown className="size-3.5" aria-hidden="true" />
                {subscription
                  ? subscription.daysRemaining == null
                    ? subscription.planName
                    : `${subscription.planName} · ${subscription.daysRemaining}d left`
                  : "No active plan"}
              </Link>
            )}
            <NotificationBell href="/dashboard/notifications" />
            <Menu
              label="Account menu"
              trigger={
                <span className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-slate-100">
                  <Avatar name={user.name} className="size-8" />
                  <span className="hidden text-left md:block">
                    <span className="block max-w-36 truncate text-sm font-medium leading-tight text-slate-900">{user.name}</span>
                    <span className="block text-[11px] capitalize leading-tight text-slate-500">{user.role.replace("_", " ").toLowerCase()}</span>
                  </span>
                </span>
              }
            >
              <div className="px-3 py-2">
                <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
                <p className="truncate text-xs text-slate-500">{user.email}</p>
              </div>
              <MenuDivider />
              <MenuItem icon={User} onClick={() => router.push("/dashboard/profile")}>
                Profile & security
              </MenuItem>
              {switchLink && (
                <MenuItem icon={ArrowLeftRight} onClick={() => router.push(switchLink.href)}>
                  {switchLink.label}
                </MenuItem>
              )}
              <MenuDivider />
              <MenuItem icon={LogOut} tone="danger" onClick={logout}>
                Sign out
              </MenuItem>
            </Menu>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
