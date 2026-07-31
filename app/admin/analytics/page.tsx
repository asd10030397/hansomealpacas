"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { AnalyticsDashboardStats } from "@/lib/website-analytics/stats";

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-xl border border-gold/25 bg-background/60 px-4 py-3">
      <p className="text-[0.65rem] uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-2 font-[family-name:var(--font-anton)] text-2xl tracking-wide text-gold-light">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

function WindowBlock({
  title,
  totals,
}: {
  title: string;
  totals: AnalyticsDashboardStats["today"];
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-[family-name:var(--font-anton)] text-sm tracking-[0.2em] text-foreground">
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Page views" value={totals.pageViews} />
        <MetricCard label="Unique visitors" value={totals.uniqueVisitors} />
        <MetricCard label="Unique IPs" value={totals.uniqueIps} />
        <MetricCard label="Sessions" value={totals.uniqueSessions} />
      </div>
      <p className="text-xs text-muted">
        Bots excluded (debug): {totals.botsExcluded.toLocaleString()}
      </p>
    </section>
  );
}

export default function AdminAnalyticsPage() {
  const [secret, setSecret] = useState("");
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<AnalyticsDashboardStats | null>(null);
  const [loading, setLoading] = useState(false);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analytics/stats", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (res.status === 401) {
        setAuthed(false);
        setStats(null);
        setError("Unauthorized — sign in with admin secret.");
        return;
      }
      if (!res.ok) {
        setError(`Stats error (${res.status})`);
        return;
      }
      const data = (await res.json()) as AnalyticsDashboardStats;
      setStats(data);
      setAuthed(true);
    } catch {
      setError("Failed to load stats.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/analytics/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
        credentials: "same-origin",
      });
      if (!res.ok) {
        setError("Invalid secret.");
        setAuthed(false);
        return;
      }
      setSecret("");
      setAuthed(true);
      await loadStats();
    } catch {
      setError("Login failed.");
    } finally {
      setLoading(false);
    }
  }

  async function onLogout() {
    await fetch("/api/analytics/admin/login", {
      method: "DELETE",
      credentials: "same-origin",
    });
    setAuthed(false);
    setStats(null);
  }

  return (
    <main className="relative min-h-screen px-6 py-12">
      <div aria-hidden="true" className="gold-glow-bg pointer-events-none absolute inset-0" />
      <div className="relative z-10 mx-auto w-full max-w-5xl space-y-10">
        <header className="space-y-2">
          <p className="font-[family-name:var(--font-anton)] text-xs tracking-[0.35em] text-gold-light">
            ADMIN
          </p>
          <h1 className="font-[family-name:var(--font-anton)] text-2xl tracking-[0.12em] text-foreground sm:text-3xl">
            WEBSITE ANALYTICS
          </h1>
          <p className="max-w-2xl text-sm text-muted">
            Private aggregates only. No raw IPs, visitor IDs, wallets, or individual
            browsing history are shown.
          </p>
        </header>

        {!authed ? (
          <form
            onSubmit={onLogin}
            className="gold-border max-w-md space-y-4 rounded-2xl p-6"
          >
            <label className="block text-left text-sm text-muted">
              Admin secret
              <input
                type="password"
                autoComplete="current-password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                className="mt-2 w-full rounded-lg border border-gold/30 bg-background px-3 py-2 text-foreground outline-none focus:border-gold"
              />
            </label>
            <button
              type="submit"
              disabled={loading || !secret}
              className="rounded-lg bg-gold/90 px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              {loading ? "…" : "Sign in"}
            </button>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
          </form>
        ) : (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void loadStats()}
              className="rounded-lg border border-gold/40 px-3 py-1.5 text-sm text-gold-light"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void onLogout()}
              className="rounded-lg border border-muted/40 px-3 py-1.5 text-sm text-muted"
            >
              Sign out
            </button>
            {loading ? <span className="text-xs text-muted">Loading…</span> : null}
          </div>
        )}

        {error && authed ? <p className="text-sm text-red-400">{error}</p> : null}

        {stats ? (
          <div className="space-y-10">
            <p className="text-xs text-muted">
              Data freshness:{" "}
              {stats.freshAsOf
                ? new Date(stats.freshAsOf).toISOString()
                : "no events yet"}{" "}
              · Generated {new Date(stats.generatedAt).toISOString()}
            </p>

            <WindowBlock title="Today (UTC)" totals={stats.today} />
            <WindowBlock title="Last 7 days" totals={stats.last7d} />
            <WindowBlock title="Last 30 days" totals={stats.last30d} />
            <WindowBlock title="All time" totals={stats.allTime} />

            <section className="space-y-3">
              <h2 className="font-[family-name:var(--font-anton)] text-sm tracking-[0.2em]">
                TOP PAGES (7D)
              </h2>
              <div className="overflow-x-auto rounded-xl border border-gold/20">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wider text-muted">
                    <tr>
                      <th className="px-3 py-2">Path</th>
                      <th className="px-3 py-2">PV</th>
                      <th className="px-3 py-2">UV*</th>
                      <th className="px-3 py-2">UIP*</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topPages.length === 0 ? (
                      <tr>
                        <td className="px-3 py-3 text-muted" colSpan={4}>
                          No page data yet.
                        </td>
                      </tr>
                    ) : (
                      stats.topPages.map((p) => (
                        <tr key={p.pathname} className="border-t border-gold/10">
                          <td className="px-3 py-2 font-mono text-xs">{p.pathname}</td>
                          <td className="px-3 py-2">{p.pageViews}</td>
                          <td className="px-3 py-2">{p.uniqueVisitors}</td>
                          <td className="px-3 py-2">{p.uniqueIps}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted">
                * UV / UIP for pages are sums of daily uniques (estimated).
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-[family-name:var(--font-anton)] text-sm tracking-[0.2em]">
                TOP REFERRERS (7D)
              </h2>
              <ul className="space-y-1 text-sm">
                {stats.topReferrers.length === 0 ? (
                  <li className="text-muted">No referrer data yet.</li>
                ) : (
                  stats.topReferrers.map((r) => (
                    <li key={r.name} className="flex justify-between gap-4 border-b border-gold/10 py-1.5">
                      <span className="font-mono text-xs">{r.name}</span>
                      <span>{r.pageViews}</span>
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="font-[family-name:var(--font-anton)] text-sm tracking-[0.2em]">
                COUNTRY (7D, EDGE HEADER)
              </h2>
              <p className="text-xs text-muted">
                Only when Vercel provides <code>x-vercel-ip-country</code>. No precise
                geolocation is stored.
              </p>
              <ul className="space-y-1 text-sm">
                {stats.countries.length === 0 ? (
                  <li className="text-muted">No country data yet.</li>
                ) : (
                  stats.countries.map((c) => (
                    <li key={c.name} className="flex justify-between gap-4 border-b border-gold/10 py-1.5">
                      <span>{c.name}</span>
                      <span>{c.pageViews}</span>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
