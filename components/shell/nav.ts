import {
  CalendarDays,
  Gauge,
  Inbox,
  KeyRound,
  LayoutGrid,
  LayoutTemplate,
  ListOrdered,
  QrCode,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Where the dashboard can go.
 *
 * Kept out of the components and imported by each client piece directly: an
 * icon is a function, and a function cannot cross from a Server Component to
 * a Client Component as a prop, so the layouts pass only the area's name.
 *
 * `top` is the pill nav (and the phone's tab bar); `rail` is the floating
 * icon groups on the left (and the avatar menu on a phone). `also` lists the
 * other paths an item stands for — the block editor is part of Bot menu.
 */
export type NavItem = { href: string; label: string; icon: LucideIcon; also?: string[] };
export type Area = "admin";

export const NAV: Record<Area, { home: string; top: NavItem[]; rail: NavItem[][]; railEnd: NavItem[] }> = {
  admin: {
    home: "/admin",
    top: [
      { href: "/admin", label: "Dashboard", icon: LayoutGrid },
      { href: "/admin/menu", label: "Bot menu", icon: ListOrdered },
      { href: "/admin/events", label: "Events", icon: CalendarDays },
      { href: "/admin/inbox", label: "Inbox", icon: Inbox },
      { href: "/admin/people", label: "People", icon: Users },
    ],
    rail: [
      [
        { href: "/admin/templates", label: "Templates", icon: LayoutTemplate },
        { href: "/admin/settings", label: "Settings", icon: Settings },
        { href: "/admin/share", label: "Share", icon: QrCode },
      ],
      [
        { href: "/admin/admins", label: "Admins", icon: KeyRound },
        { href: "/admin/usage", label: "Usage", icon: Gauge },
      ],
    ],
    railEnd: [],
  },
};

/** The area's home matches only itself — it is a prefix of every other path. */
export function isActive(item: NavItem, pathname: string, home: string): boolean {
  // A static export may serve /admin/menu/ with a trailing slash.
  const path = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  return [item.href, ...(item.also ?? [])].some((href) =>
    href === home ? path === href : path === href || path.startsWith(`${href}/`),
  );
}
