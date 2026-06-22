import * as React from "react";

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-ink-500 bg-ink-700/70 backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

type Lens = "live" | "invest" | "neutral";
const accent: Record<Lens, { text: string; ring: string; dot: string; chip: string }> = {
  live: { text: "text-live", ring: "ring-live/30", dot: "bg-live", chip: "bg-live-dim text-live" },
  invest: { text: "text-invest", ring: "ring-invest/30", dot: "bg-invest", chip: "bg-invest-dim text-invest" },
  neutral: { text: "text-fg", ring: "ring-ink-400", dot: "bg-fg-muted", chip: "bg-ink-600 text-fg-muted" },
};

export function Badge({
  children,
  lens = "neutral",
}: {
  children: React.ReactNode;
  lens?: Lens;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide",
        accent[lens].chip,
      )}
    >
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  sub,
  lens = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  lens?: Lens;
}) {
  return (
    <div className="rounded-xl border border-ink-500 bg-ink-800/60 p-4">
      <div className="text-[11px] uppercase tracking-[0.14em] text-fg-faint">{label}</div>
      <div className={cn("mt-1.5 font-display text-2xl tabular", accent[lens].text)}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-fg-muted">{sub}</div>}
    </div>
  );
}

export function Button({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white",
        "transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-fg">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-fg-faint">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-ink-500 bg-ink-800 px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-faint " +
  "focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25";

export function fmtAUD(n: number | null | undefined, opts?: { compact?: boolean }) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
    notation: opts?.compact ? "compact" : "standard",
  }).format(n);
}
