import { formatDate, istDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** The letterhead, with the document under it. */
export function Doc({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <article className="space-y-6 text-sm">
      <header className="flex items-end justify-between gap-4 border-b-2 border-black pb-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-neutral-500">Church WhatsApp Bot</p>
          <h1 className="mt-1 text-xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-0.5 text-neutral-600">{subtitle}</p>}
        </div>
        <p className="shrink-0 text-xs tabular-nums text-neutral-500">
          Generated {formatDate(istDate())}
        </p>
      </header>
      {children}
    </article>
  );
}

/** A titled block of label and value pairs. A missing value prints as a dash. */
export function Fields({
  title,
  rows,
}: {
  title?: string;
  rows: [label: string, value: string | null | undefined][];
}) {
  return (
    <section className="break-inside-avoid">
      {title && <SectionTitle>{title}</SectionTitle>}
      <dl className="grid grid-cols-[11rem_1fr] border-t">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="border-b py-1.5 text-neutral-500">{label}</dt>
            <dd className="whitespace-pre-line border-b py-1.5">{value?.trim() ? value : "—"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** `right` for amounts and counts; `nowrap` for dates in a crowded table. */
type Column = { label: string; right?: boolean; nowrap?: boolean };

/** A plain table that repeats its header on every printed page. */
export function DocTable({
  title,
  columns,
  rows,
  foot,
  empty = "Nothing to list.",
}: {
  title?: string;
  columns: Column[];
  rows: React.ReactNode[][];
  foot?: React.ReactNode[];
  empty?: string;
}) {
  const align = (i: number) => {
    const c = columns[i];
    return cn(c?.right && "text-right tabular-nums", (c?.right || c?.nowrap) && "whitespace-nowrap");
  };
  return (
    <section>
      {title && <SectionTitle>{title}</SectionTitle>}
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-y text-left text-xs text-neutral-500">
            {columns.map((c, i) => (
              <th key={c.label} className={`py-1.5 pr-3 font-medium ${align(i)}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-4 text-center text-neutral-500">{empty}</td>
            </tr>
          ) : (
            rows.map((cells, r) => (
              <tr key={r} className="break-inside-avoid border-b">
                {cells.map((cell, i) => (
                  <td key={i} className={`py-1.5 pr-3 align-top ${align(i)}`}>{cell ?? "—"}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {foot && (
          <tfoot>
            <tr className="border-t-2 border-black font-semibold">
              {foot.map((cell, i) => (
                <td key={i} className={`py-1.5 pr-3 ${align(i)}`}>{cell}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
      {children}
    </h2>
  );
}

/**
 * A photo or receipt. Eager, not lazy: the print dialog opens on load, and an
 * image still on its way prints as an empty box.
 */
export function Photo({ url, className = "size-28" }: { url: string | null; className?: string }) {
  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- served by the Worker; eager so it prints
    <img src={url} alt="" loading="eager" className={cn("shrink-0 rounded-md border object-cover", className)} />
  );
}
