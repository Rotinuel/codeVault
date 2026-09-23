"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/** Horizontally scrollable pill tabs with an animated active indicator. */
export function Tabs({ tabs, value, onChange, layoutId = "tabs", className }) {
  return (
    <div className={cn("scrollbar-thin -mx-1 overflow-x-auto px-1", className)}>
      <div role="tablist" className="inline-flex min-w-max gap-1 rounded-xl bg-slate-100 p-1">
        {tabs.map((t) => {
          const active = t.value === value;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(t.value)}
              className={cn("relative rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors", active ? "text-slate-900" : "text-slate-500 hover:text-slate-800")}
            >
              {active && (
                <motion.span layoutId={layoutId} className="absolute inset-0 rounded-lg bg-white shadow-sm" transition={{ type: "spring", damping: 30, stiffness: 400 }} />
              )}
              <span className="relative inline-flex items-center gap-1.5">
                {t.color && <span className="size-2 rounded-full" style={{ backgroundColor: t.color }} aria-hidden="true" />}
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
