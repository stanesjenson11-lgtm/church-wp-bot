import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

export type BarDatum = {
  /** Under the column: short, "Jun" or "03 May". */
  label: string;
  /** Beside the value in the tooltip and the table: "June 2026". */
  fullLabel: string;
  /** Sets the height only. Money arrives as an exact string in `display`. */
  value: number;
  display: string;
  /** A second line in the tooltip, e.g. "12 members, 3 visitors". */
  detail?: string;
  /** The same slot a period earlier, shown in the tooltip and the table. */
  compare?: { value: number; display: string };
};

// Diagonal hatch for the quiet bars, solid ink for the one in focus. Mixed
// with the card colour rather than made transparent, so the gridlines behind
// never show through and both themes get their own tint.
const HATCH: CSSProperties = {
  background:
    "repeating-linear-gradient(135deg, var(--bar-a) 0 5px, var(--bar-b) 5px 10px)",
};
const SOLID: CSSProperties = {
  background:
    "repeating-linear-gradient(135deg, var(--primary) 0 6px, color-mix(in oklab, var(--primary) 82%, black) 6px 12px)",
};

/** A step that puts about four gridlines under `max`, on a 1–2–2.5–5 ladder. */
export function niceStep(max: number): number {
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
}

/**
 * Pill-shaped columns drawn with CSS: a dozen bars needs no chart library.
 *
 * One column — the latest by default — is solid and can carry a badge; the
 * rest are hatched. Every column is focusable and shows its tooltip on hover
 * and on focus, and the same figures sit in a table for screen readers.
 */
export function BarChart({
  data,
  caption,
  series,
  highlight = data.length - 1,
  badge,
  tick = String,
}: {
  data: BarDatum[];
  /** What the chart shows, for the table and for screen readers. */
  caption: string;
  /** Names for the value and `compare`: [current, comparison]. */
  series?: [string, string];
  /** Which column is drawn solid. */
  highlight?: number;
  /** A small pill above the solid column, e.g. "+12%". */
  badge?: string;
  /** Formats a gridline's value, e.g. compact rupees. */
  tick?: (n: number) => string;
}) {
  const peak = Math.max(1, ...data.map((d) => d.value));
  const step = niceStep(peak);
  const top = Math.ceil(peak / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const pct = (v: number) => `${(v / top) * 100}%`;

  return (
    <figure className="flex h-full min-h-60 flex-col">
      <div className="relative mt-9 flex flex-1 gap-3">
        <div aria-hidden className="relative w-10 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 translate-y-1/2" style={{ bottom: pct(t) }}>
              {tick(t)}
            </span>
          ))}
        </div>

        <div className="relative flex-1">
          {ticks.map((t) => (
            <div
              key={t}
              aria-hidden
              className="absolute inset-x-0 border-t border-dashed border-foreground/10"
              style={{ bottom: pct(t) }}
            />
          ))}

          <div className="absolute inset-0 flex items-end gap-2 sm:gap-3">
            {data.map((d, i) => {
              const solid = i === highlight;
              return (
                <div
                  key={d.fullLabel}
                  tabIndex={0}
                  aria-label={`${d.fullLabel}: ${d.display}${d.compare && series ? `, ${series[1]} ${d.compare.display}` : ""}`}
                  className="group relative flex h-full min-w-0 flex-1 items-end justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div
                    className={cn(
                      "grow-bar relative w-full max-w-16 rounded-full",
                      !solid && "group-hover:brightness-95 dark:group-hover:brightness-125",
                    )}
                    style={{ ...(solid ? SOLID : HATCH), height: pct(d.value), minHeight: d.value > 0 ? 10 : 0, ["--i" as string]: i }}
                  >
                    {solid && badge && (
                      <>
                        <span
                          aria-hidden
                          className="absolute -top-1.5 left-1/2 size-3.5 -translate-x-1/2 rounded-full bg-primary ring-[3px] ring-card"
                        />
                        <span className="absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-primary-foreground tabular-nums">
                          {badge}
                        </span>
                      </>
                    )}
                  </div>
                  <div
                    role="tooltip"
                    className="pointer-events-none absolute bottom-full z-10 mb-2 scale-[0.96] rounded-xl bg-foreground px-2.5 py-1.5 text-xs whitespace-nowrap text-background opacity-0 shadow-lg transition-[opacity,scale] duration-150 ease-out group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100"
                  >
                    <strong className="tabular-nums">{d.display}</strong> <span className="opacity-70">{d.fullLabel}</span>
                    {d.detail && <div className="opacity-70">{d.detail}</div>}
                    {d.compare && series && (
                      <div className="opacity-70">
                        {series[1]}: <span className="tabular-nums">{d.compare.display}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div aria-hidden className="mt-2.5 flex gap-2 pl-13 sm:gap-3">
        {data.map((d) => (
          <span key={d.fullLabel} className="min-w-0 flex-1 truncate text-center text-[11px] font-medium text-muted-foreground uppercase">
            {d.label}
          </span>
        ))}
      </div>

      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th>Period</th>
            <th>{series?.[0] ?? "Value"}</th>
            {series && <th>{series[1]}</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.fullLabel}>
              <td>
                {d.fullLabel}
                {d.detail && ` · ${d.detail}`}
              </td>
              <td>{d.display}</td>
              {series && <td>{d.compare?.display ?? "—"}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
