"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Star } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/client/api";
import { copyText } from "@/lib/client/hooks";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/** Interactive bits of the detail page: copy, favourite, and view tracking. */
export function BetCodeActions({ id, code, initialFavorite, viewed }) {
  const [copied, setCopied] = useState(false);
  const [favorite, setFavorite] = useState(Boolean(initialFavorite));

  useEffect(() => {
    // Opening the detail page counts as viewing the code (recorded once per user).
    if (!viewed) apiFetch(`/api/betcodes/${id}/view`, { method: "POST" }).catch(() => {});
  }, [id, viewed]);

  async function copy() {
    if (await copyText(code)) {
      setCopied(true);
      toast.success("Code copied");
      setTimeout(() => setCopied(false), 1800);
    }
  }

  async function toggle() {
    const next = !favorite;
    setFavorite(next);
    try {
      await apiFetch(`/api/betcodes/${id}/favorite`, { method: "POST", body: { favorite: next } });
      toast.success(next ? "Added to favourites" : "Removed from favourites");
    } catch (e) {
      setFavorite(!next);
      toast.error(e.message);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={copy} size="lg" className="min-w-40">
        {copied ? <Check className="size-5" /> : <Copy className="size-5" />}
        {copied ? "Copied!" : "Copy code"}
      </Button>
      <Button variant="secondary" size="lg" onClick={toggle} aria-pressed={favorite}>
        <Star className={cn("size-5", favorite && "fill-amber-400 text-amber-500")} />
        {favorite ? "Favourited" : "Favourite"}
      </Button>
    </div>
  );
}
