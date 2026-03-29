"use client";

import { useEffect, useState } from "react";

interface ForexRate {
  pair: string;
  bid: number | null;
  ask: number | null;
  last: number | null;
  timestamp: number;
}

function fmt(v: number | null): string {
  if (v === null) return "—";
  return v.toFixed(4);
}

export function ForexRatesWidget() {
  const [rates, setRates] = useState<ForexRate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchRates() {
      try {
        const res = await fetch("/api/market-data/forex");
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "Unavailable" }));
          setError(body.error ?? `HTTP ${res.status}`);
          setRates([]);
          return;
        }
        const json = await res.json();
        if (!cancelled) {
          setRates(json.data ?? []);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchRates();
    const interval = setInterval(fetchRates, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-emerald-500/30" />
        Loading forex rates…
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-zinc-500">
        SIX Market Data: <span className="text-amber-400">{error}</span>
      </div>
    );
  }

  if (rates.length === 0) {
    return <div className="text-xs text-zinc-500">No forex data available.</div>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rates.map((rate) => (
        <div
          key={rate.pair}
          className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3"
        >
          <div>
            <p className="text-sm font-semibold text-white">{rate.pair}</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Bid {fmt(rate.bid)} · Ask {fmt(rate.ask)}
            </p>
          </div>
          <p className="text-lg font-medium tabular-nums text-emerald-400">
            {fmt(rate.last)}
          </p>
        </div>
      ))}
    </div>
  );
}
