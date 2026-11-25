"use client";

import { Autocomplete } from "@base-ui/react/autocomplete";
import { Dialog } from "@base-ui/react/dialog";
import {
  CalendarDays,
  CalendarPlus,
  CornerDownLeft,
  LayoutTemplate,
  ListOrdered,
  Moon,
  Search,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { Block, ChurchEvent } from "@/lib/shared/api";
import { cn } from "@/lib/utils";

import { NAV, type Area } from "./nav";
import { switchTheme } from "./shell-nav";

type Command = { value: string; label: string; hint?: string; icon?: LucideIcon; initials?: string; run: () => void };
type Group = { value: string; items: Command[] };

/** Shortcuts; "Add event" opens the Events page with its dialog already up (`?add=1`). */
const ADMIN_ACTIONS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin/events?add=1", label: "Add event", icon: CalendarPlus },
  { href: "/admin/templates", label: "Add a menu item from a template", icon: LayoutTemplate },
];

/**
 * ⌘K / Ctrl+K from anywhere, or the search button in the top bar: jump to a
 * page, start a common task, or find a menu item or event by name. The menu and
 * events are small, so they load once when the palette first opens and are
 * filtered in the browser. Built on Base UI's Dialog and Autocomplete, as in
 * their command palette example.
 */
export function CommandPalette({ area }: { area: Area }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ blocks: Block[]; events: ChurchEvent[] } | null>(null);
  const searching = open && found === null;
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { contains } = Autocomplete.useFilter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open || found) return;
    Promise.all([api.blocks(), api.events()]).then(
      ([blocks, events]) => setFound({ blocks, events }),
      () => setFound({ blocks: [], events: [] }),
    );
  }, [open, found]);

  function search(text: string) {
    setQuery(text);
  }

  const nav = NAV[area];
  const go = (href: string) => () => router.push(href);
  const actions: Command[] = [
    ...ADMIN_ACTIONS.map((a) => ({ value: `do:${a.href}`, label: a.label, icon: a.icon, run: go(a.href) })),
    {
      value: "do:theme",
      label: resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode",
      icon: resolvedTheme === "dark" ? Sun : Moon,
      run: () => switchTheme(resolvedTheme === "dark" ? "light" : "dark", setTheme),
    },
  ];
  const pages: Command[] = [...nav.top, ...nav.rail.flat(), ...nav.railEnd].map((p) => ({
    value: `go:${p.href}`,
    label: p.label,
    icon: p.icon,
    run: go(p.href),
  }));
  const match = (c: Command) => !query || contains(c.label, query);
  const typed = query.trim().length >= 2;
  const groups: Group[] = [
    {
      value: "Bot menu",
      items: (typed ? (found?.blocks ?? []) : [])
        .filter((b) => contains(`${b.title} ${b.keywords}`, query))
        .map((b) => ({
          value: `block:${b.id}`,
          label: b.title,
          hint: b.enabled ? undefined : "Hidden",
          icon: ListOrdered,
          run: go(`/admin/menu/edit?id=${encodeURIComponent(b.id)}`),
        })),
    },
    {
      value: "Events",
      items: (typed ? (found?.events ?? []) : [])
        .filter((e) => contains(`${e.title} ${e.venue}`, query))
        .map((e) => ({
          value: `event:${e.id}`,
          label: e.title,
          hint: e.date.split("-").reverse().join("-"),
          icon: CalendarDays,
          run: go(`/admin/events/view?id=${encodeURIComponent(e.id)}`),
        })),
    },
    { value: "Actions", items: actions.filter(match) },
    { value: "Go to", items: pages.filter(match) },
  ].filter((g) => g.items.length > 0);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) search("");
      }}
    >
      <Dialog.Trigger
        aria-label="Search and commands"
        className="glass flex h-11 shrink-0 items-center gap-2 rounded-full px-3 text-muted-foreground transition-[background-color,scale] duration-150 ease-out hover:bg-card active:scale-[0.95] lg:pr-2"
      >
        <Search className="size-5 text-foreground" strokeWidth={1.75} />
        <span className="hidden text-sm lg:inline">Search</span>
        <Kbd className="hidden lg:inline-flex">
          <ShortcutLabel />
        </Kbd>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/25 transition-opacity duration-200 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0 dark:bg-black/60" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-start justify-center px-3 pt-[max(4.5rem,12vh)]">
          <Dialog.Popup
            aria-label="Search and commands"
            className="squircle flex max-h-[min(34rem,calc(100dvh-6rem))] w-full max-w-xl flex-col overflow-hidden rounded-[28px] bg-popover text-popover-foreground shadow-[0_24px_64px_-16px_rgb(0_0_0/0.4)] ring-1 ring-foreground/10 transition-[opacity,scale,translate] duration-200 ease-out data-ending-style:-translate-y-2 data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-starting-style:-translate-y-2 data-starting-style:scale-[0.97] data-starting-style:opacity-0"
          >
            <Autocomplete.Root
              open
              inline
              items={groups}
              value={query}
              onValueChange={search}
              filter={null}
              autoHighlight="always"
              keepHighlight
            >
              <div className="flex items-center gap-3 border-b px-5">
                <Search aria-hidden className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                <Autocomplete.Input
                  aria-label="Search"
                  placeholder="Search the menu, events and pages…"
                  className="h-14 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
                />
                {searching && (
                  <span aria-hidden className="size-4 shrink-0 animate-spin rounded-full border-2 border-muted-foreground border-r-transparent" />
                )}
              </div>
              <Dialog.Close className="sr-only">Close</Dialog.Close>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 [scroll-padding-block:0.5rem]">
                <Autocomplete.Empty>
                  <p className="px-3 py-10 text-center text-sm text-muted-foreground">
                    {searching ? "Searching…" : `Nothing matches “${query}”.`}
                  </p>
                </Autocomplete.Empty>
                <Autocomplete.List>
                  {(group: Group) => (
                    <Autocomplete.Group key={group.value} items={group.items} className="not-last:mb-2">
                      <Autocomplete.GroupLabel className="px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                        {group.value}
                      </Autocomplete.GroupLabel>
                      <Autocomplete.Collection>
                        {(item: Command) => (
                          <Autocomplete.Item
                            key={item.value}
                            value={item}
                            onClick={() => {
                              setOpen(false);
                              item.run();
                            }}
                            className="group flex min-h-11 cursor-default items-center gap-3 rounded-2xl px-3 text-sm outline-none select-none data-highlighted:bg-foreground/[0.06]"
                          >
                            {item.icon ? (
                              <item.icon className="size-[18px] shrink-0 text-muted-foreground" strokeWidth={1.75} />
                            ) : (
                              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                                {item.initials}
                              </span>
                            )}
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                            {item.hint && <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{item.hint}</span>}
                            <CornerDownLeft
                              aria-hidden
                              className="size-4 shrink-0 text-muted-foreground opacity-0 group-data-highlighted:opacity-100"
                              strokeWidth={1.75}
                            />
                          </Autocomplete.Item>
                        )}
                      </Autocomplete.Collection>
                    </Autocomplete.Group>
                  )}
                </Autocomplete.List>
              </div>

              <div className="hidden items-center gap-4 border-t px-5 py-2.5 text-xs text-muted-foreground md:flex">
                <span className="flex items-center gap-1.5">
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd> to move
                </span>
                <span className="flex items-center gap-1.5">
                  <Kbd>Enter</Kbd> to open
                </span>
                <span className="flex items-center gap-1.5">
                  <Kbd>Esc</Kbd> to close
                </span>
              </div>
            </Autocomplete.Root>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Kbd({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-foreground/[0.07] px-1.5 font-sans text-[11px] font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

/** "⌘K" on a Mac, "Ctrl K" elsewhere. The server can't know, so the first paint may correct itself. */
function ShortcutLabel() {
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
  return <span suppressHydrationWarning>{mac ? "⌘K" : "Ctrl K"}</span>;
}
