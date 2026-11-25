import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Props = {
  icon: LucideIcon;
  title: string;
  /** One line on what fills this, or what to do next. */
  hint?: string;
  /** The obvious next step. A page's own "Add …" dialog opens from `?add=1`. */
  action?: { href: string; label: string };
  className?: string;
};

/**
 * What an empty list says instead of a grey "Nothing yet": what would be
 * here, and the button that puts it there.
 */
export function EmptyState({ icon: Icon, title, hint, action, className }: Props) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-4 py-8 text-center", className)}>
      <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {hint && <p className="mx-auto max-w-xs text-[13px] text-muted-foreground">{hint}</p>}
      </div>
      {action && (
        <Link href={action.href} scroll={false} className={cn(buttonVariants({ size: "sm" }), "mt-1")}>
          {action.label}
        </Link>
      )}
    </div>
  );
}

/** The same, as the only row of an empty table. */
export function EmptyRow({ colSpan, ...props }: Props & { colSpan: number }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="whitespace-normal">
        <EmptyState {...props} />
      </TableCell>
    </TableRow>
  );
}
