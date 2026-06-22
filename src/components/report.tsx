"use client";

import * as React from "react";
import {
  GraduationCap,
  TrainFront,
  Footprints,
  ShieldCheck,
  TrendingUp,
  Coins,
  Home,
  Ruler,
  MapPin,
  Check,
  X,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import type { EvaluationReport, CashflowYear } from "@/lib/types";
import { Card, Stat, Badge, fmtAUD, cn } from "./ui";

// ── Agent thinking tree (loading state) ──
const STEPS = [
  "Locating the property",
  "Pulling sales, comparables & rent (Domain)",
  "Reading the planning overlay for your state",
  "Scanning schools, transport & council news",
  "Modelling 3-year cashflow & tax position",
  "Writing your dual-lens summary",
];

export function ThinkingTree({ done }: { done: boolean }) {
  const [active, setActive] = React.useState(0);
  React.useEffect(() => {
    if (done) {
      setActive(STEPS.length);
      return;
    }
    const t = setInterval(() => setActive((a) => Math.min(a + 1, STEPS.length - 1)), 850);
    return () => clearInterval(t);
  }, [done]);

  return (
    <Card className="mx-auto max-w-xl p-6">
      <div className="mb-5 flex items-center gap-2 text-sm text-fg-muted">
        <Loader2 className="h-4 w-4 animate-spin text-brand" />
        Reading this property two ways…
      </div>
      <ol className="space-y-3">
        {STEPS.map((label, i) => {
          const state = done || i < active ? "done" : i === active ? "active" : "idle";
          return (
            <li key={label} className="flex items-center gap-3">
              <span
                className={cn(
                  "grid h-6 w-6 place-items-center rounded-full border text-[11px]",
                  state === "done" && "border-invest/40 bg-invest-dim text-invest",
                  state === "active" && "border-brand/50 bg-brand-dim text-brand animate-pulsering",
                  state === "idle" && "border-ink-500 text-fg-faint",
                )}
              >
                {state === "done" ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-sm",
                  state === "idle" ? "text-fg-faint" : "text-fg",
                )}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

// ── SVG suburb median growth chart ──
export function GrowthChart({ series }: { series: { year: number; medianPrice: number }[] }) {
  const data = series.filter((d) => d.medianPrice > 0);
  if (data.length < 2) return <div className="text-sm text-fg-faint">No price series available.</div>;

  const w = 520;
  const h = 160;
  const pad = { l: 8, r: 8, t: 12, b: 22 };
  const xs = data.map((_, i) => pad.l + (i * (w - pad.l - pad.r)) / (data.length - 1));
  const min = Math.min(...data.map((d) => d.medianPrice));
  const max = Math.max(...data.map((d) => d.medianPrice));
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min || 1)) * (h - pad.t - pad.b);
  const line = data.map((d, i) => `${xs[i]},${y(d.medianPrice)}`).join(" ");
  const area = `${xs[0]},${h - pad.b} ${line} ${xs[xs.length - 1]},${h - pad.b}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Suburb median price over time">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34D6A6" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#34D6A6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#g)" />
      <polyline points={line} fill="none" stroke="#34D6A6" strokeWidth="2" strokeLinejoin="round" />
      {data.map((d, i) => (
        <g key={d.year}>
          <circle cx={xs[i]} cy={y(d.medianPrice)} r="2.5" fill="#0A0D13" stroke="#34D6A6" strokeWidth="1.5" />
          {(i === 0 || i === data.length - 1) && (
            <text x={xs[i]} y={h - 6} fill="#5E6B83" fontSize="10" textAnchor={i === 0 ? "start" : "end"}>
              {d.year}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

// ── Owner-occupier tab ──
export function LiveTab({ r }: { r: EvaluationReport }) {
  const o = r.ownerOccupier;
  return (
    <div className="animate-fade-up space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat lens="live" label="School zone" value={o.schoolZoneRating != null ? `${o.schoolZoneRating}/10` : "—"} sub="catchment quality" />
        <Stat lens="live" label="Walk score" value={o.walkScoreEstimate ?? "—"} sub="estimated" />
        <Stat lens="live" label="Nearest station" value={o.nearestTrainStation ? `${o.nearestTrainStation.distanceKm}km` : "—"} sub={o.nearestTrainStation ? `${o.nearestTrainStation.driveMin} min drive` : ""} />
        <Stat lens="live" label="CBD commute" value={o.cbdCommute ? `${o.cbdCommute.driveMin}m` : "—"} sub={o.cbdCommute ? `${o.cbdCommute.distanceKm} km` : ""} />
      </div>

      <Card className="p-5">
        <p className="text-sm leading-relaxed text-fg-muted">{o.narrative}</p>
      </Card>

      <ProsCons pros={o.prosCons.pros} cons={o.prosCons.cons} />

      <Card className="p-5">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-fg">
          <ShieldCheck className="h-4 w-4 text-live" /> Area safety
        </div>
        <p className="text-sm leading-relaxed text-fg-muted">{o.crimeRateSummary}</p>
      </Card>
    </div>
  );
}

// ── Investor tab ──
export function InvestTab({ r }: { r: EvaluationReport }) {
  const inv = r.investor;
  return (
    <div className="animate-fade-up space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat lens="invest" label="Median rent" value={inv.currentMedianRent != null ? `$${inv.currentMedianRent}` : "—"} sub="per week" />
        <Stat lens="invest" label="Gross yield" value={inv.grossYieldPct != null ? `${inv.grossYieldPct}%` : "—"} sub="rent ÷ value" />
        <Stat lens="invest" label="10yr growth" value={inv.capitalGrowthCagrPct != null ? `${inv.capitalGrowthCagrPct}%` : "—"} sub="suburb CAGR" />
        <Stat lens="invest" label="Land" value={r.propertyInfo.landSqm != null ? `${r.propertyInfo.landSqm}m²` : "—"} sub={inv.secondDwellingPotential.landSupportsIt ? "2nd-dwelling potential" : "limited"} />
      </div>

      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-fg">
          <TrendingUp className="h-4 w-4 text-invest" /> Suburb median price
        </div>
        <GrowthChart series={inv.capitalGrowth10Yr} />
      </Card>

      <Card className="p-5">
        <p className="text-sm leading-relaxed text-fg-muted">{inv.narrative}</p>
      </Card>

      <CashflowTable years={inv.cashflow3Yr} />

      {inv.secondDwellingPotential.landSupportsIt ? (
        <Card className="p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-fg">
            <Ruler className="h-4 w-4 text-invest" /> Value-add potential
          </div>
          <p className="text-sm leading-relaxed text-fg-muted">
            {inv.secondDwellingPotential.summary}
          </p>
        </Card>
      ) : (
        <div className="rounded-2xl border border-danger/40 bg-danger/5 p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-danger">
            <AlertTriangle className="h-4 w-4" /> Value-add: planning watch-out
          </div>
          <p className="text-sm leading-relaxed text-fg-muted">
            {inv.secondDwellingPotential.summary}
          </p>
        </div>
      )}
    </div>
  );
}

function ProsCons({ pros, cons }: { pros: string[]; cons: string[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Card className="p-5">
        <div className="mb-3 text-sm font-medium text-live">Strengths</div>
        <ul className="space-y-2">
          {pros.map((p) => (
            <li key={p} className="flex gap-2 text-sm text-fg-muted">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-live" /> {p}
            </li>
          ))}
        </ul>
      </Card>
      <Card className="p-5">
        <div className="mb-3 text-sm font-medium text-danger">Watch-outs</div>
        <ul className="space-y-2">
          {cons.map((c) => (
            <li key={c} className="flex gap-2 text-sm text-fg-muted">
              <X className="mt-0.5 h-4 w-4 shrink-0 text-danger" /> {c}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function CashflowTable({ years }: { years: CashflowYear[] }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center gap-2 border-b border-ink-500 px-5 py-3 text-sm font-medium text-fg">
        <Coins className="h-4 w-4 text-invest" /> 3-year cashflow (indicative)
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-fg-faint">
              <th className="px-5 py-2.5 font-medium">Line</th>
              {years.map((y) => (
                <th key={y.year} className="px-4 py-2.5 text-right font-medium">{y.year}</th>
              ))}
            </tr>
          </thead>
          <tbody className="text-fg-muted">
            <Row label="Gross rent" vals={years.map((y) => y.grossRent)} />
            <Row label="Operating costs" vals={years.map((y) => -y.operatingCosts)} />
            <Row label="Loan interest" vals={years.map((y) => -y.loanInterest)} />
            <Row label="Principal repayment" vals={years.map((y) => -y.annualPrincipalRepayment)} muted />
            <Row label="Net cash (pre-tax)" vals={years.map((y) => y.netCashflowPreTax)} strong />
            <Row label="Depreciation (non-cash)" vals={years.map((y) => -y.depreciation)} muted />
            <Row label="Negative gearing benefit" vals={years.map((y) => y.negativeGearingBenefit)} accent />
            <Row label="Net cash (after tax)" vals={years.map((y) => y.netCashflowAfterTax)} strong />
          </tbody>
        </table>
      </div>
      <p className="border-t border-ink-500 px-5 py-3 text-xs leading-relaxed text-fg-faint">
        Principal repayment is cash out but builds equity — it isn't tax-deductible. Depreciation is
        non-cash; it only reduces tax. Interest-only loans show zero principal.
      </p>
    </Card>
  );
}

function Row({
  label,
  vals,
  strong,
  muted,
  accent,
}: {
  label: string;
  vals: number[];
  strong?: boolean;
  muted?: boolean;
  accent?: boolean;
}) {
  return (
    <tr className={cn("border-t border-ink-600/60", strong && "bg-ink-800/40")}>
      <td className={cn("px-5 py-2.5", strong ? "font-medium text-fg" : muted ? "text-fg-faint" : "")}>
        {label}
      </td>
      {vals.map((v, i) => (
        <td
          key={i}
          className={cn(
            "px-4 py-2.5 text-right",
            accent && "text-invest",
            strong && (v < 0 ? "text-danger" : "text-fg"),
          )}
        >
          {v < 0 ? `-${fmtAUD(Math.abs(v))}` : fmtAUD(v)}
        </td>
      ))}
    </tr>
  );
}
