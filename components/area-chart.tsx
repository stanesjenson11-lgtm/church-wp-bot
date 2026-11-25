export type AreaPoint = { label: string; value: number };

/**
 * A smooth line over a soft fill, edge to edge — a dozen points needs no chart
 * library. The SVG stretches to its box (the stroke keeps its width), and the
 * figures are repeated in a list for screen readers.
 *
 * Smoothing joins the midpoints between neighbours with quadratic curves
 * bent by the points themselves; a quadratic stays inside its control points,
 * so the line never overshoots above the highest value or below zero.
 */
export function AreaChart({ points, caption }: { points: AreaPoint[]; caption: string }) {
  const W = 100;
  const H = 40;
  const max = Math.max(1, ...points.map((p) => p.value));
  // 15% headroom on top, so the peak never touches the card's edge.
  const xy = points.map((p, i) => [
    points.length === 1 ? W / 2 : (i / (points.length - 1)) * W,
    H - (p.value / max) * H * 0.85,
  ]);
  const line = curve(xy.length === 1 ? [[0, xy[0]![1]], [W, xy[0]![1]]] : xy);

  return (
    <figure className="h-full w-full">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden className="reveal-x block h-full w-full">
        <defs>
          <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {xy.length > 0 && (
          <>
            <path d={`${line} L ${W} ${H} L 0 ${H} Z`} fill="url(#area-fill)" />
            <path
              d={line}
              fill="none"
              stroke="var(--primary-ink)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
      </svg>
      <figcaption className="sr-only">
        {caption}
        <ul>
          {points.map((p) => (
            <li key={p.label}>
              {p.label}: {p.value}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

/** "M x y L … Q …": from the first point to the last, rounding each corner in between. */
export function curve(xy: number[][]): string {
  const [first, ...rest] = xy;
  if (!first) return "";
  let d = `M ${first[0]} ${first[1]}`;
  rest.forEach((p, i) => {
    const prev = xy[i]!;
    const mx = (prev[0]! + p[0]!) / 2;
    const my = (prev[1]! + p[1]!) / 2;
    d += i === 0 ? ` L ${mx} ${my}` : ` Q ${prev[0]} ${prev[1]} ${mx} ${my}`;
  });
  const last = xy[xy.length - 1]!;
  return xy.length > 1 ? `${d} L ${last[0]} ${last[1]}` : d;
}
