import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  CalendarClock,
  ChevronDown,
  CreditCard,
  Crown,
  Layers,
  LayoutDashboard,
  Lock,
  ShieldCheck,
  Ticket,
  UserPlus,
  Wallet,
} from "lucide-react";
import { connectDB } from "@/lib/mongodb";
import SubscriptionPlan from "@/models/SubscriptionPlan";
import { getSettings } from "@/lib/settings";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { serializePlan } from "@/lib/serializers";
import { LandingNav } from "@/components/landing/LandingNav";
import { Reveal } from "@/components/landing/Reveal";
import { PlanCard } from "@/components/subscriptions/PlanCard";
import { Brand } from "@/components/layout/Brand";
import { ButtonLink } from "@/components/ui/Button";

const STEPS = [
  { icon: UserPlus, title: "Create account", text: "Sign up with your email and WhatsApp number in under a minute." },
  { icon: Crown, title: "Choose subscription", text: "Pick the plan that matches how much access you want." },
  { icon: Wallet, title: "Make payment", text: "Pay securely with card, bank or transfer via Paystack." },
  { icon: Ticket, title: "Access bet codes", text: "Codes for your plan appear on your dashboard the moment they're released." },
];

const FEATURES = [
  { icon: Layers, title: "Subscription-based access", text: "Every plan maps to an access level. Higher plans include everything below them." },
  { icon: CalendarClock, title: "Regular bet code releases", text: "Codes are scheduled and released throughout the day — morning to late evening." },
  { icon: Lock, title: "Different access levels", text: "Premium and VIP codes are only ever delivered to subscribers entitled to them." },
  { icon: BellRing, title: "Instant notifications", text: "Get a WhatsApp and in-app alert as soon as a code for your plan goes live." },
  { icon: ShieldCheck, title: "Secure payments", text: "Every Paystack payment is verified server-to-server before activation." },
  { icon: LayoutDashboard, title: "Personal dashboard", text: "Track your plan, expiry, favourites, history and receipts in one place." },
];

const FAQ = [
  {
    q: "How do I receive bet codes?",
    a: "Once your subscription is active, codes for your plan appear on your dashboard at their scheduled release time. You'll also get a WhatsApp and in-app notification.",
  },
  {
    q: "What's the difference between the plans?",
    a: "Each plan has an access level. You can see every code at or below your level — for example, Premium subscribers also receive Basic and Standard codes. Higher plans also include more analysis and longer history.",
  },
  {
    q: "Can I upgrade in the middle of my subscription?",
    a: "Yes. When you upgrade, the unused value of your current plan is converted into bonus days on the new plan, so you never lose time you've paid for.",
  },
  {
    q: "What happens when my subscription expires?",
    a: "Access to plan codes stops automatically at the expiry time. We remind you a few days before, and you can renew in a couple of clicks.",
  },
  {
    q: "Is my payment secure?",
    a: "Payments are processed by Paystack. We never see your card details, and every transaction is verified directly with Paystack before your plan is activated.",
  },
  {
    q: "Are outcomes guaranteed?",
    a: "No. Bet codes are informational picks and no outcome is ever guaranteed. Please gamble responsibly, only stake what you can afford to lose, and you must be 18 or older.",
  },
];

export default async function LandingPage() {
  await connectDB().catch(() => null);
  const [settings, user, plans] = await Promise.all([
    getSettings(),
    getCurrentUser().catch(() => null),
    SubscriptionPlan.find({ isActive: true })
      .sort({ sortOrder: 1, accessLevel: 1, price: 1 })
      .lean()
      .catch(() => []),
  ]);
  const planList = plans.map(serializePlan);
  const dashboardHref = user && isStaff(user) ? "/admin" : "/dashboard";

  return (
    <div className="bg-white">
      <LandingNav name={settings.platformName} logoUrl={settings.logoUrl} signedIn={Boolean(user)} dashboardHref={dashboardHref} />

      {/* Hero */}
      <section className="relative overflow-hidden bg-ink-950 pb-24 pt-32 text-white sm:pt-40">
        <div className="grid-bg absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" aria-hidden="true" />
        <div className="absolute left-1/2 top-0 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-brand-500/20 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
                <span className="size-1.5 rounded-full bg-brand-400" aria-hidden="true" /> New codes released every day
              </span>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-6xl">
                Bet codes, released on schedule —{" "}
                <span className="bg-linear-to-r from-brand-300 to-emerald-200 bg-clip-text text-transparent">matched to your plan.</span>
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">
                {settings.platformName} is a subscription platform for curated bet codes. Choose a plan, and every code your plan includes lands on your dashboard — with instant WhatsApp alerts.
              </p>
            </Reveal>
            <Reveal delay={0.15}>
              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <ButtonLink href={user ? dashboardHref : "/register"} size="lg" className="w-full sm:w-auto">
                  {user ? "Open dashboard" : "Get started"} <ArrowRight className="size-4" aria-hidden="true" />
                </ButtonLink>
                <ButtonLink href="#plans" size="lg" variant="outlineLight" className="w-full sm:w-auto">
                  View plans
                </ButtonLink>
                {!user && (
                  <Link href="/login" className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white">
                    Login
                  </Link>
                )}
              </div>
            </Reveal>
          </div>

          {/* Product preview */}
          <Reveal delay={0.2} className="mx-auto mt-16 max-w-4xl">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 shadow-2xl shadow-black/40 backdrop-blur">
              <div className="grid gap-3 rounded-xl bg-ink-900 p-4 sm:grid-cols-3">
                {[
                  { tier: "Basic", time: "10:00", code: "BC7K-29QX", color: "text-emerald-300", locked: false },
                  { tier: "Premium", time: "13:00", code: "PR4M-88LZ", color: "text-amber-300", locked: false },
                  { tier: "VIP", time: "20:00", code: "••••-••••", color: "text-violet-300", locked: true },
                ].map((c) => (
                  <div key={c.tier} className="rounded-xl border border-white/5 bg-white/[0.03] p-4 text-left">
                    <div className="flex items-center justify-between text-xs">
                      <span className={`font-semibold uppercase tracking-wider ${c.color}`}>{c.tier}</span>
                      <span className="text-slate-500">{c.time}</span>
                    </div>
                    <p className={`code-font mt-3 text-lg font-semibold ${c.locked ? "text-white/30 blur-[2px]" : "text-white"}`}>{c.code}</p>
                    <p className="mt-2 text-xs text-slate-500">{c.locked ? "Upgrade to VIP to unlock" : "Tap to copy"}</p>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-slate-500">Illustrative preview — sample codes only.</p>
          </Reveal>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-16 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">How it works</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">From sign-up to your first code in minutes</h2>
          </Reveal>
          <ol className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 0.06} className="card relative h-full p-6">
                  <span className="absolute right-5 top-5 text-4xl font-bold text-slate-100" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-700">
                    <s.icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 font-semibold text-slate-900">
                    {i + 1}. {s.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-500">{s.text}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Plans */}
      <section id="plans" className="scroll-mt-16 bg-ink-950 py-24 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-400">Plans</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Choose your level of access</h2>
            <p className="mt-4 text-slate-400">Higher plans include every code in the plans below them, plus deeper analysis and longer history.</p>
          </Reveal>
          {planList.length ? (
            <div className="mt-14 grid gap-6 pt-3 sm:grid-cols-2 lg:grid-cols-4">
              {planList.map((plan, i) => (
                <Reveal key={plan.id} delay={i * 0.05} className="h-full">
                  <PlanCard
                    plan={plan}
                    dark
                    action={
                      <ButtonLink href={user ? "/dashboard/subscription#plans" : `/register?plan=${plan.slug}`} className="w-full" variant={plan.isFeatured ? "primary" : "outlineLight"}>
                        {user ? "Choose plan" : "Get started"}
                      </ButtonLink>
                    }
                  />
                </Reveal>
              ))}
            </div>
          ) : (
            <p className="mt-12 text-center text-slate-400">Plans are being prepared. Check back soon.</p>
          )}
          <p className="mt-10 flex items-center justify-center gap-2 text-sm text-slate-400">
            <CreditCard className="size-4" aria-hidden="true" /> Secure payments powered by Paystack
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-16 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">Features</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Built for serious subscribers</h2>
          </Reveal>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.04} className="h-full">
                <div className="h-full rounded-2xl border border-slate-200 p-6 transition-shadow hover:shadow-md">
                  <f.icon className="size-6 text-brand-600" aria-hidden="true" />
                  <h3 className="mt-4 font-semibold text-slate-900">{f.title}</h3>
                  <p className="mt-2 text-sm text-slate-500">{f.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-16 bg-slate-50 py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <Reveal className="text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">FAQ</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Frequently asked questions</h2>
          </Reveal>
          <div className="mt-12 space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="card group p-0 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-medium text-slate-900">
                  {f.q}
                  <ChevronDown className="size-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <p className="px-5 pb-5 text-sm leading-relaxed text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-brand-600 to-brand-800 px-6 py-14 text-center text-white sm:px-12">
            <div className="grid-bg absolute inset-0 opacity-40" aria-hidden="true" />
            <div className="relative">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Ready for today&apos;s releases?</h2>
              <p className="mx-auto mt-4 max-w-xl text-brand-100">Create your account and pick a plan — your first codes are waiting on your dashboard.</p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <ButtonLink href={user ? dashboardHref : "/register"} size="lg" variant="dark">
                  {user ? "Open dashboard" : "Get started"}
                </ButtonLink>
                <ButtonLink href="#plans" size="lg" variant="outlineLight">
                  Compare plans
                </ButtonLink>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4 lg:px-8">
          <div className="md:col-span-2">
            <Brand name={settings.platformName} logoUrl={settings.logoUrl} />
            <p className="mt-3 max-w-sm text-sm text-slate-500">{settings.tagline}</p>
            <p className="mt-4 max-w-md text-xs text-slate-400">
              18+ only. Bet codes are informational and outcomes are never guaranteed. Gamble responsibly — if gambling stops being fun, take a break and seek support.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Platform</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-500">
              <li><a href="#plans" className="hover:text-slate-900">Plans</a></li>
              <li><a href="#features" className="hover:text-slate-900">Features</a></li>
              <li><a href="#faq" className="hover:text-slate-900">FAQ</a></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Account</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-500">
              <li><Link href="/login" className="hover:text-slate-900">Login</Link></li>
              <li><Link href="/register" className="hover:text-slate-900">Create account</Link></li>
              <li><Link href="/terms" className="hover:text-slate-900">Terms & responsible gambling</Link></li>
              {settings.supportEmail && <li><a href={`mailto:${settings.supportEmail}`} className="hover:text-slate-900">{settings.supportEmail}</a></li>}
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-100 py-5 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} {settings.platformName}. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
