"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Brand } from "@/components/layout/Brand";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#plans", label: "Plans" },
  { href: "#features", label: "Features" },
  { href: "#faq", label: "FAQ" },
];

export function LandingNav({ name, logoUrl, signedIn, dashboardHref }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={cn("fixed inset-x-0 top-0 z-40 transition-colors", scrolled || open ? "bg-ink-950/90 backdrop-blur border-b border-white/5" : "bg-transparent")}>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Brand name={name} logoUrl={logoUrl} dark />
        <nav className="ml-6 hidden items-center gap-6 md:flex" aria-label="Primary">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-sm font-medium text-slate-300 hover:text-white">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          {signedIn ? (
            <ButtonLink href={dashboardHref} size="sm">
              Open dashboard
            </ButtonLink>
          ) : (
            <>
              <Link href="/login" className="px-3 text-sm font-medium text-slate-300 hover:text-white">
                Login
              </Link>
              <ButtonLink href="/register" size="sm">
                Get started
              </ButtonLink>
            </>
          )}
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)} className="ml-auto rounded-lg p-2 text-slate-300 hover:bg-white/10 md:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-white/5 px-4 pb-5 md:hidden">
          <nav className="flex flex-col py-2" aria-label="Mobile">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-2 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/5">
                {l.label}
              </a>
            ))}
          </nav>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {signedIn ? (
              <ButtonLink href={dashboardHref} className="col-span-2">
                Open dashboard
              </ButtonLink>
            ) : (
              <>
                <ButtonLink href="/login" variant="outlineLight">
                  Login
                </ButtonLink>
                <ButtonLink href="/register">Get started</ButtonLink>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
