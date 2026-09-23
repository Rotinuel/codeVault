import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-lg border bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors " +
  "focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15 disabled:bg-slate-50 disabled:text-slate-500";

export function Label({ htmlFor, children, className, required }) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-1.5 block text-sm font-medium text-slate-700", className)}>
      {children}
      {required && <span className="ml-0.5 text-rose-500" aria-hidden="true">*</span>}
    </label>
  );
}

export function Input({ className, error, ...props }) {
  return (
    <input
      className={cn(fieldBase, "h-10", error ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/15" : "border-slate-300", className)}
      aria-invalid={error ? "true" : undefined}
      {...props}
    />
  );
}

export function Textarea({ className, error, rows = 4, ...props }) {
  return (
    <textarea
      rows={rows}
      className={cn(fieldBase, "py-2 leading-relaxed", error ? "border-rose-400" : "border-slate-300", className)}
      aria-invalid={error ? "true" : undefined}
      {...props}
    />
  );
}

export function Select({ className, error, children, ...props }) {
  return (
    <div className="relative">
      <select
        className={cn(fieldBase, "h-10 appearance-none pr-9", error ? "border-rose-400" : "border-slate-300", className)}
        aria-invalid={error ? "true" : undefined}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
    </div>
  );
}

export function FieldError({ id, children }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-xs font-medium text-rose-600">
      {children}
    </p>
  );
}

export function Hint({ children }) {
  return <p className="mt-1.5 text-xs text-slate-500">{children}</p>;
}

/** Label + control + error in one block. */
export function Field({ label, htmlFor, error, hint, required, children, className }) {
  return (
    <div className={className}>
      {label && (
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
      )}
      {children}
      {error ? <FieldError id={`${htmlFor}-error`}>{error}</FieldError> : hint ? <Hint>{hint}</Hint> : null}
    </div>
  );
}

export function Switch({ checked, onChange, label, description, id, disabled }) {
  return (
    <label htmlFor={id} className={cn("flex items-start justify-between gap-4", disabled ? "opacity-60" : "cursor-pointer")}>
      <span>
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-slate-500">{description}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          id={id}
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={Boolean(checked)}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.checked)}
        />
        <span className="h-6 w-11 rounded-full bg-slate-300 transition-colors peer-checked:bg-brand-600 peer-focus-visible:ring-4 peer-focus-visible:ring-brand-500/25" />
        <span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export function Checkbox({ id, checked, onChange, label, className }) {
  return (
    <label htmlFor={id} className={cn("inline-flex cursor-pointer items-start gap-2.5 text-sm text-slate-700", className)}>
      <input
        id={id}
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(e) => onChange?.(e.target.checked)}
        className="mt-0.5 size-4 rounded border-slate-300 accent-brand-600"
      />
      <span>{label}</span>
    </label>
  );
}
