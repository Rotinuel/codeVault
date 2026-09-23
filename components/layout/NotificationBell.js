"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CheckCheck, CreditCard, Info, ShieldAlert, Ticket, Crown } from "lucide-react";
import { apiFetch } from "@/lib/client/api";
import { cn, timeAgo } from "@/lib/utils";
import { Spinner } from "@/components/ui/Primitives";

const TYPE_ICON = { PAYMENT: CreditCard, SUBSCRIPTION: Crown, BET_CODE: Ticket, SECURITY: ShieldAlert, SYSTEM: Info };

export function NotificationBell({ href = "/dashboard/notifications" }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const data = await apiFetch("/api/notifications?limit=8");
      setItems(data.notifications || []);
      setUnread(data.unreadCount || 0);
    } catch {
      /* non-critical */
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      await load();
      setLoading(false);
    }
  }

  async function markAll() {
    try {
      await apiFetch("/api/notifications/read-all", { method: "POST" });
      setItems((xs) => xs.map((x) => ({ ...x, read: true })));
      setUnread(0);
    } catch {
      /* ignore */
    }
  }

  async function openItem(n) {
    setOpen(false);
    if (!n.read) {
      apiFetch(`/api/notifications/${n.id}`, { method: "PATCH", body: { read: true } }).catch(() => {});
      setUnread((u) => Math.max(0, u - 1));
      setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    if (n.link) router.push(n.link);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        className="relative grid size-10 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        aria-label={unread ? `Notifications (${unread} unread)` : "Notifications"}
        aria-expanded={open}
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-4 text-white ring-2 ring-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-x-3 top-16 z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-(--shadow-pop) sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">Notifications</p>
              {unread > 0 && (
                <button type="button" onClick={markAll} className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800">
                  <CheckCheck className="size-3.5" /> Mark all read
                </button>
              )}
            </div>
            <div className="scrollbar-thin max-h-96 overflow-y-auto">
              {loading && !items.length ? (
                <div className="grid place-items-center py-10">
                  <Spinner />
                </div>
              ) : items.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-slate-500">You&apos;re all caught up.</p>
              ) : (
                items.map((n) => {
                  const I = TYPE_ICON[n.type] || Info;
                  return (
                    <button key={n.id} type="button" onClick={() => openItem(n)} className={cn("flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50", !n.read && "bg-brand-50/40")}>
                      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
                        <I className="size-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-slate-900">{n.title}</span>
                          {!n.read && <span className="size-1.5 shrink-0 rounded-full bg-brand-500" aria-label="unread" />}
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-xs text-slate-500">{n.message}</span>
                        <span className="mt-1 block text-[11px] text-slate-400">{timeAgo(n.createdAt)}</span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
            <Link href={href} onClick={() => setOpen(false)} className="block border-t border-slate-100 px-4 py-2.5 text-center text-sm font-medium text-brand-700 hover:bg-slate-50">
              View all notifications
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
