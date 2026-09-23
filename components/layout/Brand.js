import Link from "next/link";
import { Vault } from "lucide-react";
import { cn } from "@/lib/utils";

export function Brand({ name = "CodeVault", logoUrl, href = "/", dark = false, className }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5 font-semibold tracking-tight", dark ? "text-white" : "text-slate-900", className)}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="size-8 rounded-lg object-contain" />
      ) : (
        <span className="grid size-8 place-items-center rounded-lg bg-linear-to-br from-brand-400 to-brand-700 text-white shadow-sm shadow-brand-900/30">
          <Vault className="size-[18px]" aria-hidden="true" />
        </span>
      )}
      <span className="text-[1.05rem]">{name}</span>
    </Link>
  );
}
