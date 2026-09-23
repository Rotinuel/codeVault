"use client";

import { useEffect, useMemo, useState } from "react";
import { Crown, Ticket } from "lucide-react";
import { useApi } from "@/lib/client/hooks";
import { toQuery } from "@/lib/client/api";
import { Tabs } from "@/components/ui/Tabs";
import { SearchInput } from "@/components/ui/DataTable";
import { EmptyState, ErrorState } from "@/components/ui/Primitives";
import { Button, ButtonLink } from "@/components/ui/Button";
import { BetCodeCard, BetCodeCardSkeleton, LockedCard } from "./BetCodeCard";

const BASE_TABS = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "live", label: "Live" },
  { value: "favorites", label: "Favourites" },
  { value: "history", label: "History" },
];

/**
 * The user's bet code feed. Everything shown comes from /api/betcodes, which
 * already filtered by subscription level on the server — this component never
 * receives codes the user isn't entitled to.
 */
export function BetCodeBoard({ categories = [], timezone, limit = 12, compact = false, hasSubscription }) {
  const tabs = useMemo(
    () => [
      ...(compact ? BASE_TABS.slice(0, 3) : BASE_TABS),
      ...categories.filter((c) => c.showAsTab).map((c) => ({ value: `cat:${c.slug}`, label: c.name, color: c.color })),
    ],
    [categories, compact]
  );
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);

  useEffect(() => {
    const t = setTimeout(() => setQ(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
    setItems([]);
  }, [tab, q]);

  const isCategory = tab.startsWith("cat:");
  const url = `/api/betcodes${toQuery({
    tab: isCategory ? "all" : tab,
    category: isCategory ? tab.slice(4) : undefined,
    q,
    page,
    limit,
  })}`;
  const { data, error, loading, reload } = useApi(url);

  useEffect(() => {
    if (!data) return;
    setItems((prev) => (page === 1 ? data.items : [...prev, ...data.items.filter((i) => !prev.some((p) => p.id === i.id))]));
  }, [data, page]);

  const locked = data?.locked || [];
  const meta = data?.meta;
  const showSkeleton = loading && items.length === 0;

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs tabs={tabs} value={tab} onChange={setTab} layoutId={compact ? "bc-tabs-compact" : "bc-tabs"} />
        {!compact && <SearchInput value={search} onChange={setSearch} placeholder="Search bet codes…" />}
      </div>

      {error ? (
        <div className="card">
          <ErrorState description={error.message} onRetry={reload} />
        </div>
      ) : showSkeleton ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: compact ? 3 : 6 }).map((_, i) => (
            <BetCodeCardSkeleton key={i} />
          ))}
        </div>
      ) : items.length === 0 && locked.length === 0 ? (
        <div className="card">
          {hasSubscription === false && tab !== "favorites" ? (
            <EmptyState
              icon={Crown}
              title="Subscribe to unlock bet codes"
              description="Choose a plan to start receiving bet codes as soon as they're released."
              action={<ButtonLink href="/dashboard/subscription">View plans</ButtonLink>}
            />
          ) : (
            <EmptyState
              icon={Ticket}
              title={tab === "upcoming" ? "No upcoming releases" : tab === "favorites" ? "No favourites yet" : "No bet codes here yet"}
              description={
                tab === "upcoming"
                  ? "Scheduled releases for your plan will appear here with a countdown."
                  : tab === "favorites"
                    ? "Tap the star on any bet code to save it here."
                    : "New codes appear here the moment they're released."
              }
            />
          )}
        </div>
      ) : (
        <>
          {items.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <BetCodeCard key={item.id} item={item} timezone={timezone} onChange={tab === "favorites" ? reload : undefined} />
              ))}
            </div>
          )}
          {meta && meta.page < meta.pages && (
            <div className="mt-6 flex justify-center">
              <Button variant="secondary" onClick={() => setPage((p) => p + 1)} loading={loading}>
                Load more
              </Button>
            </div>
          )}
          {locked.length > 0 && (
            <section className="mt-8" aria-labelledby="locked-heading">
              <div className="mb-3 flex items-center gap-2">
                <Crown className="size-4 text-amber-500" aria-hidden="true" />
                <h3 id="locked-heading" className="text-sm font-semibold text-slate-900">
                  Available on higher plans
                </h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {locked.map((item) => (
                  <LockedCard key={item.id} item={item} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
