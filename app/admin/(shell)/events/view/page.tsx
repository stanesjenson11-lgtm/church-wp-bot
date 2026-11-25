"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { CalendarDays, ChevronLeft, Download, MapPin, Printer, Trash, Users } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { Confirm } from "@/components/confirm";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { EventForm } from "@/components/event-form";
import { Toggle } from "@/components/fields";
import { FormDialog } from "@/components/form-dialog";
import { ListSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { eventDay } from "@/components/whatsapp-preview";
import { api } from "@/lib/api";
import { formatDateTime, prettyPhone, whatsappLink } from "@/lib/format";
import type { Registration } from "@/lib/shared/api";
import type { ChurchEvent } from "@/lib/shared/blocks";
import { attempt, useLoad } from "@/lib/use-load";
import { cn } from "@/lib/utils";

export default function EventViewPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Loader />
    </Suspense>
  );
}

function Loader() {
  const id = useSearchParams().get("id") ?? "";
  const { data, set } = useLoad(() => Promise.all([api.events(), api.registrations(id)]));
  if (!data) return <ListSkeleton />;
  const [events, regs] = data;
  const event = events.find((e) => e.id === id);
  if (!event) {
    return (
      <div className="tile">
        <EmptyState icon={CalendarDays} title="This event no longer exists" action={{ href: "/admin/events", label: "Back to events" }} />
      </div>
    );
  }
  return (
    <EventView
      event={event}
      regs={regs}
      onEvent={(e) => set([events.map((x) => (x.id === e.id ? e : x)), regs])}
      onRegs={(next) => set([events, next])}
    />
  );
}


function csv(event: ChurchEvent, regs: Registration[]): string {
  const labels = event.questions.map((q) => q.label);
  const cell = (v: string | number) => {
    const s = String(v);
    // A leading = + - @ would run as a formula in Excel; a quote keeps it text.
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const head = ["Name", "WhatsApp", "People", "Status", "Checked in", "Registered", ...labels];
  const rows = regs.map((r) => [
    r.name,
    `+${r.waId}`,
    r.headcount,
    r.status,
    r.checkedIn ? "yes" : "",
    formatDateTime(r.createdAt),
    ...event.questions.map((q) => r.answers[q.id] ?? ""),
  ]);
  return [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([`﻿${text}`], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

function EventView({
  event,
  regs,
  onEvent,
  onRegs,
}: {
  event: ChurchEvent;
  regs: Registration[];
  onEvent: (e: ChurchEvent) => void;
  onRegs: (r: Registration[]) => void;
}) {
  const router = useRouter();
  const confirmed = regs.filter((r) => r.status === "confirmed");
  const people = confirmed.reduce((s, r) => s + r.headcount, 0);
  const arrived = confirmed.filter((r) => r.checkedIn).reduce((s, r) => s + r.headcount, 0);
  const pct = event.capacity ? Math.min(100, Math.round((people / event.capacity) * 100)) : null;

  async function update(r: Registration, patch: { checkedIn?: boolean; status?: Registration["status"] }) {
    const saved = await attempt(() => api.updateRegistration(r.id, patch));
    if (saved) onRegs(regs.map((x) => (x.id === saved.id ? saved : x)));
  }

  const columns: ColumnDef<Registration>[] = [
    {
      header: "Name",
      cell: ({ row: { original: r } }) => (
        <span className={cn("font-medium", r.status === "cancelled" && "text-muted-foreground line-through")}>{r.name || "No name"}</span>
      ),
    },
    {
      header: "WhatsApp",
      cell: ({ row: { original: r } }) => (
        <a href={whatsappLink(r.waId, "")} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap tabular-nums hover:underline">
          {prettyPhone(r.waId)}
        </a>
      ),
    },
    { header: "People", cell: ({ row: { original: r } }) => <span className="tabular-nums">{r.headcount}</span> },
    ...event.questions.map(
      (q): ColumnDef<Registration> => ({
        header: q.label.length > 28 ? `${q.label.slice(0, 27)}…` : q.label,
        id: q.id,
        cell: ({ row: { original: r } }) => <span className="whitespace-normal">{r.answers[q.id] || "—"}</span>,
      }),
    ),
    {
      header: "Registered",
      cell: ({ row: { original: r } }) => <span className="whitespace-nowrap text-muted-foreground tabular-nums">{formatDateTime(r.createdAt)}</span>,
    },
    {
      header: "Here",
      cell: ({ row: { original: r } }) =>
        r.status === "confirmed" ? (
          <Toggle hideLabel label={`${r.name} has arrived`} checked={r.checkedIn} onChange={(checkedIn) => void update(r, { checkedIn })} />
        ) : (
          <Badge variant="outline">Cancelled</Badge>
        ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row: { original: r } }) => (
        <Button variant="ghost" size="sm" onClick={() => void update(r, { status: r.status === "confirmed" ? "cancelled" : "confirmed" })}>
          {r.status === "confirmed" ? "Cancel" : "Restore"}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-3">
        <Link
          href="/admin/events"
          aria-label="Back to events"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary transition-[background-color,scale] duration-150 ease-out hover:bg-foreground/[0.08] active:scale-[0.95]"
        >
          <ChevronLeft className="size-5" strokeWidth={1.75} />
        </Link>
        <div className="min-w-0 flex-1 basis-56">
          <h2 className="text-xl font-semibold tracking-tight">{event.title}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-4" strokeWidth={1.75} />
              {[eventDay(event.date), event.time].filter(Boolean).join(" · ")}
            </span>
            {event.venue && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4" strokeWidth={1.75} />
                {event.venue}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href={`/print/event?id=${encodeURIComponent(event.id)}`} target="_blank" rel="noopener" className={cn(buttonVariants({ variant: "secondary" }), "gap-1.5")}>
            <Printer />
            Print list
          </a>
          <Button variant="secondary" className="gap-1.5" onClick={() => download(`${event.title} registrations.csv`, csv(event, regs))} disabled={regs.length === 0}>
            <Download />
            Export CSV
          </Button>
          <FormDialog trigger="Edit" title="Edit event" wide variant="secondary">
            <EventForm event={event} onSaved={onEvent} />
          </FormDialog>
          <Confirm
            trigger={
              <Button variant="ghost" size="icon" aria-label="Delete event">
                <Trash />
              </Button>
            }
            title={`Delete “${event.title}”?`}
            description={`It disappears from the bot straight away, with its ${regs.length} registrations. Export the list first if you need it.`}
            action="Delete event"
            onConfirm={async () => {
              if (await attempt(() => api.deleteEvent(event.id), "Event deleted")) router.push("/admin/events");
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="tile p-4 sm:p-5">
          <p className="text-[13px] text-muted-foreground">Coming</p>
          <p className="mt-0.5 text-2xl leading-tight font-medium tracking-[-0.03em] tabular-nums sm:text-[1.75rem]">
            {people}
            {event.capacity && <span className="text-base font-normal text-muted-foreground"> of {event.capacity}</span>}
          </p>
          {pct !== null && (
            <div role="meter" aria-label="Places taken" aria-valuenow={people} aria-valuemin={0} aria-valuemax={event.capacity ?? undefined} className="mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/[0.08]">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
        <div className="tile p-4 sm:p-5">
          <p className="text-[13px] text-muted-foreground">Registrations</p>
          <p className="mt-0.5 text-2xl leading-tight font-medium tracking-[-0.03em] tabular-nums sm:text-[1.75rem]">{confirmed.length}</p>
          <p className="text-[13px] text-muted-foreground">{regs.length - confirmed.length > 0 ? `${regs.length - confirmed.length} cancelled` : "None cancelled"}</p>
        </div>
        <div className="tile p-4 sm:p-5">
          <p className="text-[13px] text-muted-foreground">Arrived</p>
          <p className="mt-0.5 text-2xl leading-tight font-medium tracking-[-0.03em] tabular-nums sm:text-[1.75rem]">{arrived}</p>
          <p className="text-[13px] text-muted-foreground">Tick names at the door</p>
        </div>
      </div>

      <div className="tile overflow-x-auto px-2">
        <DataTable
          columns={columns}
          rows={regs}
          emptyMessage={
            <EmptyState
              icon={Users}
              title="No registrations yet"
              hint={event.signupOpen ? "When members tap Register in WhatsApp, their names appear here." : "Registration is off for this event."}
            />
          }
        />
      </div>
    </div>
  );
}
