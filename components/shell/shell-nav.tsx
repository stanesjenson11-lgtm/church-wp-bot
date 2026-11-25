"use client";

import { ChevronDown, LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ViewTransition } from "react";

import { api } from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { NAV, isActive, type Area, type NavItem } from "./nav";

const ICON = { className: "size-5", strokeWidth: 1.75 } as const;
const press = "transition-[background-color,color,scale] duration-150 ease-out active:scale-[0.95]";

/**
 * The grey selection behind the current section. One element per bar carries
 * the name, so when a navigation moves it to another item React morphs it
 * across rather than blinking it out and in — the sliding pill of iOS.
 */
function Highlight({ name }: { name: string }) {
  return (
    <ViewTransition name={name}>
      <span aria-hidden className="absolute inset-0 -z-10 rounded-full bg-foreground/[0.08]" />
    </ViewTransition>
  );
}

/** The centred capsule of sections in the top bar, from a tablet up. */
export function PillNav({ area }: { area: Area }) {
  const pathname = usePathname();
  const { home, top } = NAV[area];

  return (
    <nav aria-label="Sections" className="glass flex items-center gap-0.5 rounded-full p-1">
      {top.map((item) => {
        const current = isActive(item, pathname, home);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "relative isolate rounded-full px-3.5 py-2 text-sm font-medium lg:px-4",
              press,
              current ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {current && <Highlight name="nav-pill" />}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function RailLink({ item, current }: { item: NavItem; current: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-label={item.label}
      aria-current={current ? "page" : undefined}
      className={cn(
        "group/rail relative grid size-11 place-items-center rounded-full",
        press,
        current
          ? "bg-primary text-primary-foreground shadow-[0_4px_12px_-4px_var(--primary)]"
          : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
      )}
    >
      <Icon {...ICON} />
      <Tip>{item.label}</Tip>
    </Link>
  );
}

/** A label beside a rail icon on hover or keyboard focus; the icon alone is the touch target. */
function Tip({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-full z-50 ml-3 scale-[0.96] rounded-full bg-foreground px-2.5 py-1 text-xs font-medium whitespace-nowrap text-background opacity-0 transition-[opacity,scale] duration-150 ease-out group-hover/rail:scale-100 group-hover/rail:opacity-100 group-focus-visible/rail:scale-100 group-focus-visible/rail:opacity-100"
    >
      {children}
    </span>
  );
}

/**
 * The floating icon groups on the left, from a tablet up. Light/dark is pinned
 * to the bottom; signing out lives in the avatar menu.
 */
export function SideRail({ area }: { area: Area }) {
  const pathname = usePathname();
  const { home, rail, railEnd } = NAV[area];
  const group = "dock glass flex flex-col items-center gap-1 rounded-full p-1.5";

  return (
    <aside aria-label="Tools" className="flex h-full flex-col gap-3">
      {rail.map((items, i) => (
        <div key={i} className={group}>
          {items.map((item) => (
            <RailLink key={item.href} item={item} current={isActive(item, pathname, home)} />
          ))}
        </div>
      ))}
      <div className={cn(group, "mt-auto")}>
        {railEnd.map((item) => (
          <RailLink key={item.href} item={item} current={isActive(item, pathname, home)} />
        ))}
        <ThemeToggle
          className={cn(
            "group/rail relative grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
            press,
          )}
        >
          <Tip>Light or dark</Tip>
        </ThemeToggle>
      </div>
    </aside>
  );
}

/** The phone's floating tab bar: the same sections as the pill nav, under the thumb. */
export function TabBar({ area }: { area: Area }) {
  const pathname = usePathname();
  const { home, top } = NAV[area];

  return (
    <nav
      aria-label="Sections"
      className="glass fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] z-40 flex rounded-full p-1.5 md:hidden"
    >
      {top.map((item) => {
        const current = isActive(item, pathname, home);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "relative isolate flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 text-[11px] font-medium",
              press,
              current ? "text-ink" : "text-muted-foreground",
            )}
          >
            {current && <Highlight name="tab-pill" />}
            <Icon {...ICON} strokeWidth={current ? 2.25 : 1.75} />
            <span className="max-w-full truncate px-1">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Switch theme with the new one spreading in a circle from `from` (the
 * pointer, or the middle of the screen).
 *
 * The class is flipped by hand inside the View Transition callback: the
 * browser snapshots the "after" state the moment the callback returns, and
 * next-themes would only apply it on a later render. Without View Transitions,
 * or for anyone who asked for less motion, it simply switches.
 */
export function switchTheme(
  next: "light" | "dark",
  setTheme: (theme: string) => void,
  from?: { x: number; y: number },
) {
  const apply = () => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(next);
    root.style.colorScheme = next;
    setTheme(next);
  };
  if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) return apply();

  const x = from?.x ?? innerWidth / 2;
  const y = from?.y ?? innerHeight / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  void document.startViewTransition(apply).ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 450, easing: "cubic-bezier(0.23, 1, 0.32, 1)", pseudoElement: "::view-transition-new(root)" },
    );
  });
}

/**
 * Light or dark. Starts on the device's setting; a press pins the other one
 * (next-themes keeps it). Both icons are rendered and CSS shows the right one,
 * so the server's HTML never disagrees with the client's.
 */
export function ThemeToggle({ className, children }: { className?: string; children?: React.ReactNode }) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      type="button"
      aria-label="Switch between light and dark"
      onClick={(e) => switchTheme(resolvedTheme === "dark" ? "light" : "dark", setTheme, { x: e.clientX, y: e.clientY })}
      className={className}
    >
      <Moon {...ICON} className="size-5 dark:hidden" />
      <Sun {...ICON} className="hidden size-5 dark:block" />
      {children}
    </button>
  );
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?"
  );
}

/** The signed-in person's initials on burgundy (the bot dashboard keeps no photos). */
function Face({ name, className }: { name: string; className: string }) {
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full bg-primary font-semibold text-primary-foreground", className)}>
      {initials(name)}
    </span>
  );
}

/**
 * The signed-in person, and on a phone the rail's tools and light/dark too —
 * there is no rail there.
 */
export function UserMenu({ area, name, email }: { area: Area; name: string; email: string }) {
  const { rail, railEnd } = NAV[area];
  const tools = [...rail.flat(), ...railEnd];
  const { resolvedTheme, setTheme } = useTheme();

  async function signOut() {
    // Leave even if the request fails: the cookie is HttpOnly, and the login
    // screen starts a fresh session either way.
    await api.logout().catch(() => {});
    location.assign("/admin/login");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account"
        className={cn("glass flex items-center gap-1 rounded-full p-0.5 hover:bg-card md:pr-2.5", press)}
      >
        <Face name={name} className="size-10 text-sm" />
        <ChevronDown className="hidden size-4 text-muted-foreground md:block" strokeWidth={2} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-3 px-2.5 py-2">
            <Face name={name} className="size-14 text-lg" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground">{name}</span>
              <span className="block truncate font-normal">{email}</span>
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuGroup className="md:hidden">
          <DropdownMenuSeparator />
          {tools.map(({ href, label, icon: Icon }) => (
            <DropdownMenuItem key={href} render={<Link href={href} />}>
              <Icon strokeWidth={1.75} />
              {label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onClick={(e) => switchTheme(resolvedTheme === "dark" ? "light" : "dark", setTheme, { x: e.clientX, y: e.clientY })}>
            {resolvedTheme === "dark" ? <Sun strokeWidth={1.75} /> : <Moon strokeWidth={1.75} />}
            {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => void signOut()}>
          <LogOut strokeWidth={1.75} />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
