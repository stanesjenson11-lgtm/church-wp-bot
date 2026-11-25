import { CalendarDays } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { CardHead } from "@/components/dash";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import type { ChurchEvent } from "@/lib/shared/blocks";

/**
 * The next events, by day, each with how many people have registered and how
 * full it is. Adapted from church-members' "Coming up" card: same layout, but
 * events with sign-ups in place of birthdays and anniversaries.
 */
export function UpcomingCard({ today, events }: { today: string; events: ChurchEvent[] }) {
  const dates = [...new Set(events.map((e) => e.date))].sort();

  return (
    <Card id="coming-up" className="scroll-mt-28">
      <CardHead icon={CalendarDays} title="Coming up" description="Registrations so far" href="/admin/events" />
      <CardContent>
        {dates.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No events yet"
            hint="Add one and members can register for it in WhatsApp."
            action={{ href: "/admin/events?add=1", label: "Add event" }}
            className="py-4"
          />
        ) : (
          <ul className="space-y-4">
            {dates.map((date) => (
              <li key={date}>
                <p className={`text-xs font-medium ${date === today ? "text-ink" : "text-muted-foreground"}`}>{dayLabel(date, today)}</p>
                <ul className="mt-1.5 space-y-2.5 text-sm">
                  {events
                    .filter((e) => e.date === date)
                    .map((e) => {
                      const pct = e.capacity ? Math.min(100, Math.round((e.registered / e.capacity) * 100)) : null;
                      return (
                        <li key={e.id}>
                          <Link href={`/admin/events/view?id=${encodeURIComponent(e.id)}`} className="group block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                            <span className="flex items-baseline gap-2">
                              <span className="min-w-0 flex-1 truncate group-hover:underline">
                                {e.title}
                                <span className="text-muted-foreground">{e.time ? ` · ${e.time}` : ""}</span>
                              </span>
                              <span className="shrink-0 text-[13px] tabular-nums text-muted-foreground">
                                <span className="font-medium text-foreground">{e.registered}</span>
                                {e.capacity ? ` / ${e.capacity}` : " coming"}
                              </span>
                            </span>
                            {pct !== null && (
                              <span
                                role="meter"
                                aria-valuenow={e.registered}
                                aria-valuemin={0}
                                aria-valuemax={e.capacity ?? undefined}
                                aria-label={`${e.title}: ${e.registered} of ${e.capacity} places taken`}
                                className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-foreground/[0.08]"
                              >
                                <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                              </span>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function dayLabel(date: string, today: string): string {
  const days = (Date.parse(date) - Date.parse(today)) / 86_400_000;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  const weekday = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "long",
    timeZone: "UTC",
  });
  return `${weekday} · ${formatDate(date)}`;
}
