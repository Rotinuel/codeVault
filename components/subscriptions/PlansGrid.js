"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/client/api";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Modal";
import { PlanCard } from "./PlanCard";
import { formatCurrency } from "@/lib/utils";

function actionFor(plan, current, isStaff) {
  if (isStaff) return { label: "Staff accounts can't subscribe", disabled: true };
  if (!current) return { label: plan.price === 0 ? "Start free" : "Subscribe", endpoint: "/api/subscriptions/subscribe", kind: "NEW" };
  if (current.planId === plan.id) return { label: "Renew plan", endpoint: "/api/subscriptions/renew", kind: "RENEWAL", variant: "secondary" };
  if (plan.accessLevel > current.accessLevel) return { label: `Upgrade to ${plan.name}`, endpoint: "/api/subscriptions/upgrade", kind: "UPGRADE" };
  if (plan.accessLevel === current.accessLevel) return { label: `Switch to ${plan.name}`, endpoint: "/api/subscriptions/upgrade", kind: "SWITCH", variant: "secondary" };
  return { label: "Included in your plan", disabled: true };
}

export function PlansGrid({ plans, current, isStaff, highlightRenew = false, discountPercent = 0 }) {
  const priceFor = (plan) => (discountPercent > 0 && plan.price > 0 ? Math.round(plan.price * (100 - discountPercent)) / 100 : plan.price);
  const router = useRouter();
  const [pending, setPending] = useState(null);
  const [confirm, setConfirm] = useState(null);

  async function checkout(plan, action) {
    setPending(plan.id);
    try {
      const data = await apiFetch(action.endpoint, { method: "POST", body: { planId: plan.id } });
      if (data.free) {
        toast.success("Your plan is active!");
        router.push(data.redirectUrl || "/dashboard");
        router.refresh();
        return;
      }
      if (data.reused) toast.info("Resuming your pending checkout…");
      // Paystack-hosted checkout. The result is verified server-side on return.
      window.location.assign(data.authorizationUrl);
    } catch (e) {
      toast.error(e.message);
      setPending(null);
    }
  }

  function onSelect(plan, action) {
    if (action.kind === "UPGRADE" || action.kind === "SWITCH") setConfirm({ plan, action });
    else checkout(plan, action);
  }

  return (
    <>
      <div className="grid gap-6 pt-3 sm:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => {
          const action = actionFor(plan, current, isStaff);
          const isCurrent = current?.planId === plan.id;
          return (
            <PlanCard
              key={plan.id}
              plan={plan}
              discountPercent={discountPercent}
              current={isCurrent}
              highlight={highlightRenew ? isCurrent : undefined}
              action={
                <Button
                  className="w-full"
                  variant={action.disabled ? "secondary" : action.variant || "primary"}
                  disabled={action.disabled || (pending && pending !== plan.id)}
                  loading={pending === plan.id}
                  onClick={() => onSelect(plan, action)}
                >
                  {action.label}
                </Button>
              }
            />
          );
        })}
      </div>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        tone="primary"
        title={confirm ? `${confirm.action.kind === "UPGRADE" ? "Upgrade" : "Switch"} to ${confirm.plan.name}?` : ""}
        confirmLabel={confirm ? `Pay ${formatCurrency(priceFor(confirm.plan), confirm.plan.currency)}` : "Continue"}
        loading={Boolean(confirm && pending === confirm.plan.id)}
        onConfirm={() => checkout(confirm.plan, confirm.action)}
        description={
          <>
            Your new plan starts immediately after payment. The unused value of your current <strong>{current?.planName}</strong> subscription is converted
            into bonus days on the new plan, so you never lose paid time.
          </>
        }
      />
    </>
  );
}
