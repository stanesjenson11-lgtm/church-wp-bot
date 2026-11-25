import { ArrowUpRight, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * The small pieces the dashboard's cards share: the round arrow to the full
 * page, the change badge, the icon tile beside a title, and the card header.
 */

const roundButton =
  "grid shrink-0 place-items-center rounded-full bg-secondary text-foreground transition-[background-color,scale] duration-150 ease-out hover:bg-foreground/[0.08] active:scale-[0.95]";

export function CardLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} aria-label={label} className={cn(roundButton, "size-10")}>
      <ArrowUpRight className="size-[18px]" strokeWidth={1.75} />
    </Link>
  );
}

export function IconTile({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span aria-hidden className={cn(roundButton, "size-10 hover:bg-secondary active:scale-100")}>
      <Icon className="size-[18px]" strokeWidth={1.75} />
    </span>
  );
}

/** "+12%" in brand ink when up, a quiet "−5%" when down, nothing when there is nothing to compare. */
export function Delta({ pct, suffix = "%", className }: { pct: number | null; suffix?: string; className?: string }) {
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
        up ? "bg-primary text-primary-foreground" : "bg-foreground/[0.07] text-muted-foreground",
        className,
      )}
    >
      {up ? "+" : "−"}
      {Math.abs(pct)}
      {suffix}
    </span>
  );
}

/** Percentage change from `before` to `after`, rounded; null when there is no base. */
export function pctChange(before: number | undefined, after: number | undefined): number | null {
  if (before === undefined || after === undefined || before <= 0) return null;
  return Math.round(((after - before) * 100) / before);
}

/**
 * A card's top row as the reference draws it: an optional icon tile, the
 * title over a quiet subtitle, then any controls and the round arrow.
 */
export function CardHead({
  title,
  description,
  icon,
  href,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  icon?: LucideIcon;
  /** Where the arrow goes; no arrow without it. */
  href?: string;
  /** Controls between the title and the arrow, e.g. a segmented toggle. */
  children?: React.ReactNode;
}) {
  return (
    <CardHeader className="flex flex-wrap items-center gap-3">
      {icon && <IconTile icon={icon} />}
      <div className="min-w-0 flex-1">
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </div>
      {children}
      {href && <CardLink href={href} label={title} />}
    </CardHeader>
  );
}
