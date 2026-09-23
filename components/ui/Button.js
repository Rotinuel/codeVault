import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const VARIANTS = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-900/10 disabled:bg-brand-600/60",
  secondary: "bg-white text-slate-800 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm",
  ghost: "text-slate-700 hover:bg-slate-100",
  danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-sm disabled:bg-rose-600/60",
  dark: "bg-ink-900 text-white hover:bg-ink-800 shadow-sm",
  outlineLight: "border border-white/20 text-white hover:bg-white/10",
  gold: "bg-linear-to-r from-gold-400 to-gold-500 text-ink-950 hover:brightness-105 shadow-sm",
};

const SIZES = {
  xs: "h-7 px-2.5 text-xs gap-1.5 rounded-md",
  sm: "h-9 px-3 text-sm gap-2 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-lg",
  lg: "h-12 px-6 text-base gap-2.5 rounded-xl",
  icon: "h-9 w-9 rounded-lg justify-center",
};

export function buttonClasses({ variant = "primary", size = "md", className } = {}) {
  return cn(
    "inline-flex items-center justify-center font-medium transition-colors duration-150",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
    "disabled:cursor-not-allowed disabled:opacity-70 whitespace-nowrap select-none",
    VARIANTS[variant],
    SIZES[size],
    className
  );
}

export function Button({ variant, size, className, loading = false, disabled, children, type = "button", ...props }) {
  return (
    <button type={type} className={buttonClasses({ variant, size, className })} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function ButtonLink({ href, variant, size, className, children, ...props }) {
  return (
    <Link href={href} className={buttonClasses({ variant, size, className })} {...props}>
      {children}
    </Link>
  );
}
