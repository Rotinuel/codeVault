"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Ellipsis } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Dropdown menu rendered in a portal with fixed positioning, so it is never
 * clipped by scrollable table containers. Closes on outside click, Escape,
 * scroll and resize.
 */
export function Menu({ trigger, children, align = "right", className, label = "Open menu" }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const menuH = menuRef.current?.offsetHeight || 220;
    const below = r.bottom + 8 + menuH < window.innerHeight;
    setPos({
      top: below ? r.bottom + 6 : Math.max(8, r.top - menuH - 6),
      left: align === "left" ? r.left : undefined,
      right: align === "right" ? Math.max(8, window.innerWidth - r.right) : undefined,
    });
  }, [open, align]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (btnRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const close = () => setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className="inline-flex items-center"
      >
        {trigger ?? (
          <span className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700">
            <Ellipsis className="size-4" />
          </span>
        )}
      </button>
      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={menuRef}
                role="menu"
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.12 }}
                style={{ position: "fixed", top: pos?.top ?? -9999, left: pos?.left, right: pos?.right }}
                className={cn("z-[60] min-w-52 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 text-left shadow-(--shadow-pop)", className)}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                }}
              >
                {children}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}

export function MenuItem({ icon: Icon, children, onClick, tone, disabled }) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-normal normal-case tracking-normal transition-colors disabled:opacity-50",
        tone === "danger" ? "text-rose-600 hover:bg-rose-50" : "text-slate-700 hover:bg-slate-100"
      )}
    >
      {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function MenuDivider() {
  return <div className="my-1 h-px bg-slate-100" role="separator" />;
}
