"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, ChevronLeft, ChevronRight, X } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

const AUTO_MS = 4500;

function compact(n) {
  if (n >= 1_000_000) return `${Math.round((n / 1_000_000) * 10) / 10}M`;
  if (n >= 1_000) return `${Math.round((n / 1_000) * 10) / 10}K`;
  return String(Math.round(n));
}

/** Auto-advancing, swipeable carousel of verified (anonymous) winning tickets. */
export function WinnersCarousel({ tickets }) {
  const track = useRef(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [zoom, setZoom] = useState(null);
  const count = tickets.length;

  const scrollTo = useCallback(
    (i) => {
      const el = track.current;
      if (!el || !count) return;
      const next = ((i % count) + count) % count;
      const card = el.children[next];
      if (card) el.scrollTo({ left: card.offsetLeft - el.offsetLeft, behavior: "smooth" });
      setIndex(next);
    },
    [count]
  );

  // Track the visible card while the user swipes.
  useEffect(() => {
    const el = track.current;
    if (!el) return undefined;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = el.children[0]?.getBoundingClientRect().width || 1;
        setIndex(Math.min(count - 1, Math.round(el.scrollLeft / (w + 20))));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [count]);

  // Auto-advance, unless paused, zoomed, or the visitor prefers reduced motion.
  useEffect(() => {
    if (paused || zoom || count < 2) return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    const el = track.current;
    const id = setInterval(() => {
      const atEnd = el && el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
      scrollTo(atEnd ? 0 : index + 1);
    }, AUTO_MS);
    return () => clearInterval(id);
  }, [paused, zoom, count, index, scrollTo]);

  useEffect(() => {
    if (!zoom) return undefined;
    const onKey = (e) => e.key === "Escape" && setZoom(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);

  if (!count) return null;

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Winning tickets from subscribers"
    >
      <ul
        ref={track}
        className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {tickets.map((t, i) => {
          const multiple = t.stake > 0 ? t.payout / t.stake : 0;
          return (
            <li
              key={t.id}
              className="w-[78%] shrink-0 snap-start sm:w-[calc(50%-10px)] lg:w-[calc(33.333%-14px)] xl:w-[calc(25%-15px)]"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
            >
              <figure className="group h-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-lg">
                <button type="button" onClick={() => setZoom(t)} className="relative block aspect-[4/5] w-full overflow-hidden bg-slate-100" aria-label="View ticket full size">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.imageUrl} alt={`Winning ${t.bookmaker} ticket`} className="size-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]" loading={i < 4 ? "eager" : "lazy"} />
                  <span className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-ink-950/80 to-transparent" aria-hidden="true" />
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-xs font-semibold text-brand-700 shadow-sm">
                    <BadgeCheck className="size-3.5" aria-hidden="true" /> Verified win
                  </span>
                  {multiple >= 2 && (
                    <span className="absolute right-3 top-3 rounded-full bg-gold-400 px-2 py-1 text-xs font-bold text-ink-950 shadow-sm">{compact(multiple)}×</span>
                  )}
                  <span className="absolute bottom-3 left-3 text-left text-white">
                    <span className="block text-2xl font-bold tracking-tight">{formatCurrency(t.payout, t.currency)}</span>
                    <span className="block text-xs text-slate-200">from a {formatCurrency(t.stake, t.currency)} stake</span>
                  </span>
                </button>
                <figcaption className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="font-medium text-slate-800">{t.bookmaker}</span>
                  <span className="text-slate-500">{t.wonAt ? formatDate(t.wonAt) : ""}</span>
                </figcaption>
              </figure>
            </li>
          );
        })}
      </ul>

      {count > 1 && (
        <div className="mt-6 flex items-center justify-center gap-4">
          <button type="button" onClick={() => scrollTo(index - 1)} className="grid size-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50" aria-label="Previous ticket">
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <div className="flex max-w-[60vw] flex-wrap justify-center gap-1.5">
            {tickets.map((t, i) => (
              <button
                key={t.id}
                type="button"
                onClick={() => scrollTo(i)}
                className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-brand-600" : "w-2 bg-slate-300 hover:bg-slate-400"}`}
                aria-label={`Go to ticket ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
              />
            ))}
          </div>
          <button type="button" onClick={() => scrollTo(index + 1)} className="grid size-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50" aria-label="Next ticket">
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
        </div>
      )}

      {zoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/90 p-4" role="dialog" aria-modal="true" aria-label="Winning ticket" onClick={() => setZoom(null)}>
          <button type="button" className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Close" onClick={() => setZoom(null)}>
            <X className="size-5" aria-hidden="true" />
          </button>
          <div className="max-h-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={zoom.imageUrl} alt={`Winning ${zoom.bookmaker} ticket`} className="max-h-[80vh] w-auto rounded-xl object-contain" />
            <p className="mt-3 text-center text-white">
              <span className="text-xl font-bold">{formatCurrency(zoom.payout, zoom.currency)}</span>
              <span className="text-slate-300"> · {zoom.bookmaker} · stake {formatCurrency(zoom.stake, zoom.currency)}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
