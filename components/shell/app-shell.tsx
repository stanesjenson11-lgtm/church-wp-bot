"use client";

import { Bell, Church } from "lucide-react";
import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";

import { BentoSkeleton } from "@/components/skeletons";
import { api } from "@/lib/api";
import { prettyPhone } from "@/lib/format";
import type { Me } from "@/lib/shared/api";
import { cn } from "@/lib/utils";

import { CommandPalette } from "./command-palette";
import { NAV, type Area } from "./nav";
import { PillNav, SideRail, TabBar, UserMenu } from "./shell-nav";

const round =
  "glass grid size-11 shrink-0 place-items-center rounded-full text-foreground transition-[background-color,scale] duration-150 ease-out hover:bg-card active:scale-[0.95]";

const ViewerContext = createContext<Me | null>(null);

/** The signed-in admin (name, role, the bot's number). Only inside AppShell. */
export function useViewer(): Me {
  const me = useContext(ViewerContext);
  if (!me) throw new Error("useViewer outside AppShell");
  return me;
}

/**
 * The frame every signed-in page sits in: floating glass controls along the
 * top, glass icon groups down the left, and on a phone a glass tab bar at the
 * bottom in place of both.
 *
 * Presentation only. A static export has no server to redirect from, so this
 * asks /api/me; a 401 there sends the person to the login screen (lib/api.ts).
 * Every API route still checks the session and role for itself.
 */
export function AppShell({
  area,
  narrow = false,
  children,
}: {
  area: Area;
  /** Caps the content width — the staff screens are mostly single forms. */
  narrow?: boolean;
  children: React.ReactNode;
}) {
  const [viewer, setViewer] = useState<Me | null>(null);
  const { home } = NAV[area];

  useEffect(() => {
    api.me().then(setViewer, () => {});
  }, []);

  return (
    <div className="flex min-h-dvh flex-col">
      {/* No bar: each control is its own glass piece floating over the page, as
          in iOS 26. The strip between them lets clicks through to the content. */}
      <header className="pointer-events-none sticky top-0 z-40 px-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] md:px-6">
        <div className="flex h-14 items-center gap-3 *:pointer-events-auto md:h-16">
          <Link href={home} className="glass flex shrink-0 items-center gap-2.5 rounded-full p-1 lg:pr-4 max-md:pr-4">
            <span className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground">
              <Church className="size-[18px]" strokeWidth={1.75} />
            </span>
            <span className="text-lg font-semibold tracking-[-0.02em] text-ink md:hidden lg:inline">Church</span>
          </Link>

          <div className="pointer-events-none! hidden min-w-0 flex-1 justify-center md:flex">
            <div className="pointer-events-auto">
              <PillNav area={area} />
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <CommandPalette area={area} />
            <Link href="/admin/inbox" aria-label="Inbox" className={round}>
              <Bell className="size-5" strokeWidth={1.75} />
            </Link>
            <UserMenu area={area} name={viewer?.name ?? ""} email={viewer ? roleLine(viewer) : ""} />
          </div>
        </div>
      </header>

      <div className="flex flex-1 gap-5 px-3 pt-4 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:px-6 md:pt-6 md:pb-6">
        {/* z-30: above the page (so a rail label never slides under a card), below the top bar. */}
        <div className="sticky top-[100px] z-30 hidden h-[calc(100dvh-124px)] shrink-0 md:block">
          <SideRail area={area} />
        </div>
        <main className={cn("min-w-0 flex-1", narrow && "mx-auto max-w-5xl")}>
          {viewer ? <ViewerContext.Provider value={viewer}>{children}</ViewerContext.Provider> : <BentoSkeleton />}
        </main>
      </div>

      <TabBar area={area} />
    </div>
  );
}

/** "+91 98765 43210 · Admin", under the name in the account menu. */
function roleLine(me: Me): string {
  return `${prettyPhone(me.phone)} · ${me.role === "admin" ? "Admin" : "Editor"}`;
}
