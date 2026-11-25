"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * A tab strip for sections that are two views of the same thing — Members and
 * Families are two views of one roll, Giving and Vendors are two views of the
 * money — rather than separate entries in the top nav.
 *
 * Links rather than client-side state: each view is its own server-rendered
 * page with its own filters, and a toggle that swapped them in the browser
 * would have to hold both.
 */
export type SectionTab = { href: string; label: string };

export const MEMBER_TABS: SectionTab[] = [
  { href: "/members", label: "Members" },
  { href: "/families", label: "Families" },
  { href: "/shepherds", label: "Shepherds" },
];

export const GIVING_TABS: SectionTab[] = [
  { href: "/giving", label: "Giving" },
  { href: "/food/vendors", label: "Vendors" },
];

export function SectionTabs({ tabs }: { tabs: SectionTab[] }) {
  const pathname = usePathname();

  return (
    <div
      className="inline-flex max-w-full overflow-x-auto rounded-full bg-foreground/[0.06] p-1 [scrollbar-width:none]"
      role="tablist"
    >
      {tabs.map((tab) => {
        const current = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={current}
            className={
              current
                ? "shrink-0 rounded-full bg-card px-4 py-1.5 text-sm font-medium shadow-sm transition-[scale] duration-150 ease-out active:scale-[0.97]"
                : "shrink-0 rounded-full px-4 py-1.5 text-sm text-muted-foreground transition-[color,scale] duration-150 ease-out hover:text-foreground active:scale-[0.97]"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
