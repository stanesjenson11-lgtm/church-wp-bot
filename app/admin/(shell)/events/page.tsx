"use client";

import { CalendarDays, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Suspense, useState } from "react";

import { EmptyRow } from "@/components/empty-state";
import { EventForm } from "@/components/event-form";
import { PageHead } from "@/components/fields";
import { FormDialog } from "@/components/form-dialog";
import { ListSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { eventDay } from "@/components/whatsapp-preview";
import { api } from "@/lib/api";
import { istDate } from "@/lib/format";
import type { ChurchEvent } from "@/lib/shared/blocks";
import { useLoad } from "@/lib/use-load";
import { cn } from "@/lib/utils";

export default function EventsPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Events />
    </Suspense>
  );
}

function signup(e: ChurchEvent, today: string): { label: string; variant: "default" | "secondary" | "outline" } {
  if (!e.signupOpen) return { label: "No registration", variant: "outline" };
  if (e.capacity && e.registered >= e.capacity) return { label: "Full", variant: "secondary" };
  if ((e.signupCloses ?? e.date) < today) return { label: "Closed", variant: "secondary" };
  return { label: "Open", variant: "default" };
}

function Events() {
  const { data, set } = useLoad(api.events);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  if (!data) return <ListSkeleton />;
  const today = istDate();
  const upcoming = data.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = data.filter((e) => e.date < today).sort((a, b) => b.date.localeCompare(a.date));
  const rows = tab === "upcoming" ? upcoming : past;

  return (
    <div className="space-y-6">
      <PageHead title="Events" description="Members see upcoming events in the bot and can register in the chat.">
        <FormDialog trigger="Add event" title="Add an event" openParam="add" wide>
          <EventForm onSaved={(e) => set([...data, e])} />
        </FormDialog>
      </PageHead>

      <div role="tablist" aria-label="Which events" className="inline-flex rounded-full bg-foreground/[0.06] p-1">
        {(
          [
            ["upcoming", `Upcoming · ${upcoming.length}`],
            ["past", `Past · ${past.length}`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm transition-[color,scale] duration-150 ease-out active:scale-[0.97]",
              tab === value ? "bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="tile overflow-hidden px-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Event</TableHead>
              <TableHead className="hidden md:table-cell">Place</TableHead>
              <TableHead className="text-right">Coming</TableHead>
              <TableHead className="hidden sm:table-cell">Registration</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <EmptyRow
                colSpan={6}
                icon={CalendarDays}
                title={tab === "upcoming" ? "Nothing coming up" : "No past events"}
                hint={tab === "upcoming" ? "Add a service, retreat or outreach. Members can register in WhatsApp." : undefined}
                action={tab === "upcoming" ? { href: "?add=1", label: "Add event" } : undefined}
              />
            ) : (
              rows.map((e) => {
                const status = signup(e, today);
                const href = `/admin/events/view?id=${encodeURIComponent(e.id)}`;
                return (
                  <TableRow key={e.id} className="relative">
                    <TableCell className="whitespace-nowrap tabular-nums">{eventDay(e.date)}</TableCell>
                    <TableCell className="font-medium">
                      {/* The whole row opens the event; the link is stretched over it. */}
                      <Link href={href} className="after:absolute after:inset-0 hover:underline">
                        {e.title}
                      </Link>
                      {e.time && <span className="font-normal text-muted-foreground"> · {e.time}</span>}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{e.venue || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {e.registered}
                      {e.capacity ? <span className="text-muted-foreground"> / {e.capacity}</span> : null}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
