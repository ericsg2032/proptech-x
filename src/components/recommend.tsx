"use client";

import * as React from "react";
import {
  MapPin,
  Star,
  ExternalLink,
  ArrowUpRight,
  AlertTriangle,
  Loader2,
  Home,
  TrendingUp,
  Database,
} from "lucide-react";
import type { FactorScore, PrimaryIntent, Recommendation, StrategyRating } from "@/lib/types";
import { Card, Badge, cn, fmtAUD } from "./ui";

const THINK_STEPS = [
  "Parsing your intent & budget",
  "Searching active listings (Domain)",
  "Pulling suburb stats, rent & planning per property",
  "Running the 10-factor matrix",
  "Scoring development strategies",
  "Writing data-backed reasoning",
];

export function AgentThinking() {
  const [active, setActive] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setActive((a) => Math.min(a + 1, THINK_STEPS.length - 1)), 700);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="rounded-2xl border border-ink-500 bg-ink-700/60 p-5">
      <div className="mb-4 flex items-center gap-2 text-sm text-fg-muted">
        <Loader2 className="h-4 w-4 animate-spin text-brand" /> Working through it…
      </div>
      <ol className="space-y-2.5">
        {THINK_STEPS.map((s, i) => (
          <li key={s} className={cn("flex items-center gap-2.5 text-sm", i <= active ? "text-fg" : "text-fg-faint")}>
            <span className={cn("h-1.5 w-1.5 rounded-full", i < active ? "bg-invest" : i === active ? "bg-brand animate-pulsering" : "bg-ink-400")} />
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function RecommendationCard({
  rec,
  rank,
  intent,
  onOpenReport,
}: {
  rec: Recommendation;
  rank: number;
  intent: PrimaryIntent;
  onOpenReport: (rec: Recommendation) => void;
}) {
  const l = rec.listing;
  const overlayWatch = rec.planning.overlays.heritage || rec.planning.overlays.flood || rec.planning.overlays.easement;
  return (
    <Card className="animate-fade-up overflow-hidden">
      <div className="border-b border-ink-500 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-xs text-fg-faint">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-dim text-[11px] font-semibold text-brand">{rank}</span>
              <MapPin className="h-3.5 w-3.5" />
              <span className="truncate">{l.address}</span>
            </div>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-display text-2xl text-fg tabular">{fmtAUD(rec.estimatedValue)}</span>
              <span className="flex flex-wrap gap-1.5 text-xs text-fg-muted">
                <Spec>{l.beds ?? "—"} bd</Spec>
                <Spec>{l.baths ?? "—"} ba</Spec>
                <Spec>{l.cars ?? "—"} car</Spec>
                <Spec>{l.landSqm ?? "—"} m²</Spec>
                {l.frontageM != null && <Spec>{l.frontageM} m front</Spec>}
              </span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-display text-2xl tabular text-fg">{rec.compositeScore}</div>
            <div className="text-[10px] uppercase tracking-wider text-fg-faint">match</div>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="grid grid-cols-3 gap-2">
          {intent === "invest" ? (
            <>
              <Metric label="Gross yield" value={rec.grossYieldPct != null ? `${rec.grossYieldPct}%` : "—"} lens="invest" />
              <Metric label="Land ratio" value={rec.landToAssetRatioPct != null ? `${rec.landToAssetRatioPct}%` : "—"} lens="invest" badge={rec.strongLandPlay ? "strong" : undefined} />
              <Metric label="10yr CAGR" value={rec.cagrPct != null ? `${rec.cagrPct}%` : "—"} lens="invest" />
            </>
          ) : (
            <>
              <Metric label="School (SQS)" value={rec.sqs != null ? `${rec.sqs}/10` : "—"} lens="live" />
              <Metric label="Land" value={rec.listing.landSqm != null ? `${rec.listing.landSqm}m²` : "—"} lens="live" />
              <Metric label="Gross yield" value={rec.grossYieldPct != null ? `${rec.grossYieldPct}%` : "—"} lens="live" />
            </>
          )}
        </div>

        <p className="text-sm leading-relaxed text-fg-muted">{rec.recommendationReason}</p>

        <div>
          <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-fg-faint">Top factors</div>
          <div className="space-y-2">
            {rec.topFactors.map((f) => (
              <FactorBar key={f.key} f={f} />
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-fg-faint">Strategy ratings</div>
          <div className="space-y-1.5">
            {rec.strategies.map((s) => (
              <StrategyRow key={s.strategy} s={s} />
            ))}
          </div>
        </div>

        {overlayWatch && (
          <div className="flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/5 p-3 text-xs text-fg-muted">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
            Planning overlay flagged — development upside is constrained; confirm with council.
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => onOpenReport(rec)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Full dual-lens report <ArrowUpRight className="h-4 w-4" />
          </button>
          {l.listingUrl && (
            <a href={l.listingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl border border-ink-500 px-3 py-2 text-sm text-fg-muted hover:text-fg">
              View on Domain <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </Card>
  );
}

function FactorBar({ f }: { f: FactorScore }) {
  const tone = f.lens === "live" ? "bg-live" : "bg-invest";
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-fg">
          {f.lens === "live" ? <Home className="h-3 w-3 text-live" /> : <TrendingUp className="h-3 w-3 text-invest" />}
          {f.label}
        </span>
        <span className="text-fg-muted">{f.detail}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-ink-600">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${f.score}%` }} />
      </div>
      {f.source && (
        <div className="mt-1 flex items-center gap-1 text-[9px] text-fg-faint">
          <Database className="h-2.5 w-2.5" />
          {f.source}
        </div>
      )}
    </div>
  );
}

function StrategyRow({ s }: { s: StrategyRating }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg bg-ink-800/40 px-3 py-2">
      <div className="min-w-0">
        <div className="text-xs font-medium text-fg">{s.label}</div>
        <div className="text-[11px] text-fg-faint">{s.reason}</div>
      </div>
      <div className="shrink-0 text-right">
        <Stars n={s.stars} />
        <div className="mt-0.5 text-[10px] text-fg-muted tabular">{s.econ}</div>
      </div>
    </div>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn("h-3 w-3", i <= n ? "fill-live text-live" : "text-ink-400")} />
      ))}
    </span>
  );
}

function Spec({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md border border-ink-500 bg-ink-800 px-1.5 py-0.5">{children}</span>;
}

function Metric({ label, value, lens, badge }: { label: string; value: string; lens: "live" | "invest"; badge?: string }) {
  return (
    <div className="rounded-xl border border-ink-500 bg-ink-800/60 p-2.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-fg-faint">
        {label}
        {badge && <span className={cn("rounded-full px-1 text-[8px] font-semibold", lens === "invest" ? "bg-invest-dim text-invest" : "bg-live-dim text-live")}>{badge}</span>}
      </div>
      <div className={cn("mt-0.5 font-display text-lg tabular", lens === "invest" ? "text-invest" : "text-live")}>{value}</div>
    </div>
  );
}
