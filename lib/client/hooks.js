"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, toQuery } from "./api";

/** Fetch JSON from our API with loading/error state and a reload() function. */
export function useApi(url, { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled && url));
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled || !url) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    apiFetch(url, { signal: controller.signal })
      .then((d) => setData(d))
      .catch((e) => {
        if (e?.name !== "AbortError") setError(e);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [url, enabled, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload, setData };
}

/**
 * Server-driven list state (search, filters, sort, pagination) for admin tables.
 * Search input is debounced; changing any filter resets to page 1.
 */
export function useListQuery(endpoint, initial = {}) {
  const [params, setParams] = useState({ page: 1, limit: 20, sort: undefined, order: "desc", q: "", ...initial });
  const [search, setSearch] = useState(params.q || "");
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setParams((p) => (p.q === search ? p : { ...p, q: search, page: 1 }));
    }, 350);
    return () => clearTimeout(timer.current);
  }, [search]);

  const url = `${endpoint}${toQuery(params)}`;
  const api = useApi(url);

  const setFilter = useCallback((key, value) => setParams((p) => ({ ...p, [key]: value, page: 1 })), []);
  const setPage = useCallback((page) => setParams((p) => ({ ...p, page })), []);
  const toggleSort = useCallback(
    (key) =>
      setParams((p) => ({
        ...p,
        sort: key,
        order: p.sort === key && p.order === "desc" ? "asc" : "desc",
        page: 1,
      })),
    []
  );

  return { ...api, params, search, setSearch, setFilter, setPage, toggleSort };
}

/** Copy text to the clipboard with a fallback for older browsers. */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}
