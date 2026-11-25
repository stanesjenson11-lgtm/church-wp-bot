"use client";

import { Church, Inbox, MessageCircle, MousePointerClick, Plus, Users } from "lucide-react";
import Link from "next/link";

import { AreaChart } from "@/components/area-chart";
import { BarChart } from "@/components/bar-chart";
import { CardHead, Delta } from "@/components/dash";
import { EmptyState } from "@/components/empty-state";
import { RollingNumber } from "@/components/rolling-number";
import { useViewer } from "@/components/shell/app-shell";
import { BentoSkeleton } from "@/components/skeletons";
import { TiltCard } from "@/components/tilt-card";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UpcomingCard } from "@/components/upcoming-card";
import { api } from "@/lib/api";
import { formatMoney, istDate } from "@/lib/format";
import { useLoad } from "@/lib/use-load";
import { cn } from "@/lib/utils";

/** A card's place in the entrance stagger (the `rise` utility in globals.css). */
const order = (i: number) => ({ "--i": i }) as React.CSSProperties;
const monthName = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const shortDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/** "4 minutes ago", "yesterday": when a member last wrote to the bot. */
function ago(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  const rtf = new Intl.RelativeTimeFormat("en-IN", { numeric: "auto" });
  if (mins < 60) return rtf.format(-mins, "minute");
  if (mins < 60 * 24) return rtf.format(-Math.round(mins / 60), "hour");
  return rtf.format(-Math.round(mins / 1440), "day");
}

/**
 * The first screen, laid out as the church-members bento grid: the month's
 * free WhatsApp replies up front (every reply past them costs money), then
 * who's using the bot, what's coming up, and what's waiting in the Inbox.
 */
export default function DashboardPage() {
  const viewer = useViewer();
  const { data } = useLoad(api.overview);
  if (!data) return <BentoSkeleton />;

  const { usage, daily, people, inbox, upcoming, taps, lastMessageAt } = data;
  const firstName = viewer.name.trim().split(/\s+/)[0] ?? "";
  const used = Math.min(usage.sent, usage.free);
  const freePct = usage.free ? Math.min(100, (used / usage.free) * 100) : 0;
  const weekTotal = daily.slice(-7).reduce((s, d) => s + d.sent, 0);
  const lastWeek = daily.slice(-14, -7).reduce((s, d) => s + d.sent, 0);
  const waiting = inbox.reduce((s, i) => s + i.count, 0);

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <h1 className="text-[2rem] leading-[1.1] font-medium tracking-[-0.03em] md:text-[2.75rem]">
            Welcome back{firstName && ", "}
            {firstName && <span className="text-muted-foreground">{firstName}</span>}
          </h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <span aria-hidden className={cn("size-2 rounded-full", lastMessageAt ? "bg-[#25d366]" : "bg-foreground/20")} />
            {lastMessageAt ? `Last message from a member ${ago(lastMessageAt)}` : "No messages yet. Send “Hi” to the bot to try it."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/events?add=1" className={cn(buttonVariants({ variant: "secondary" }), "h-11 gap-2 px-4")}>
            <Plus className="size-[18px]" strokeWidth={1.75} />
            Add event
          </Link>
        </div>
      </div>

      <div className="@container">
        <div className="grid grid-flow-row-dense gap-4 @3xl:grid-cols-2 @6xl:grid-cols-[minmax(0,1fr)_minmax(0,1.55fr)_minmax(0,1.1fr)]">
          {/* Free replies, set like the church-members membership card. */}
          <Card className="rise gap-4 pb-2.5" style={order(0)}>
            <CardHead title="WhatsApp replies" description={monthName(usage.month)} href="/admin/usage" />
            <CardContent className="px-2.5">
              <TiltCard className="squircle relative overflow-hidden rounded-[22px] bg-primary p-5 text-primary-foreground shadow-[0_16px_32px_-18px_var(--primary)]">
                <div aria-hidden className="pointer-events-none absolute -top-28 -right-16 size-64 rounded-full bg-white/12 blur-2xl" />
                <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-12 size-60 rounded-full bg-black/20 blur-2xl" />
                <div className="relative flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-lg font-semibold tracking-[-0.02em] italic">
                    <Church className="size-5" strokeWidth={2} />
                    Church
                  </span>
                  <MessageCircle aria-hidden className="size-5 opacity-80" strokeWidth={1.75} />
                </div>
                <p className="relative mt-6 text-xs font-medium opacity-75">Free replies used</p>
                <p className="relative flex items-baseline gap-2">
                  <RollingNumber value={used} className="text-[2.5rem] leading-tight font-medium tracking-[-0.03em]" />
                  <span className="text-sm opacity-75 tabular-nums">of {usage.free.toLocaleString("en-IN")}</span>
                </p>
                <div
                  role="meter"
                  aria-label="Free replies used this month"
                  aria-valuenow={used}
                  aria-valuemin={0}
                  aria-valuemax={usage.free}
                  className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-white/20"
                >
                  <div className="h-full rounded-full bg-white transition-[width] duration-700 ease-out" style={{ width: `${freePct}%` }} />
                </div>
                <div className="relative mt-5 flex items-center justify-between gap-3 text-xs font-medium tracking-wide opacity-90">
                  <span>
                    {usage.paid > 0 ? `${usage.paid.toLocaleString("en-IN")} PAID · ${formatMoney(String(usage.cost))}` : "₹0 SPENT"}
                  </span>
                  <span>RESETS {shortDay(usage.resetsOn).toUpperCase()}</span>
                </div>
              </TiltCard>
            </CardContent>
          </Card>

          <Card className="rise justify-center @3xl:col-start-1" style={order(1)}>
            <CardContent className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] text-muted-foreground">People this week</p>
                <RollingNumber value={people.activeThisWeek} className="block text-[1.75rem] leading-tight font-medium tracking-[-0.03em]" />
                <p className="text-[13px] text-muted-foreground">
                  {people.newThisWeek > 0 ? `${people.newThisWeek} new · ` : ""}
                  {people.total.toLocaleString("en-IN")} in all
                </p>
              </div>
              <Link href="/admin/people" aria-label="People" className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary transition-[background-color,scale] duration-150 ease-out hover:bg-foreground/[0.08] active:scale-[0.95]">
                <Users className="size-[18px]" strokeWidth={1.75} />
              </Link>
            </CardContent>
          </Card>

          <Card className="rise gap-3 pb-0 @3xl:row-span-2" style={order(2)}>
            <CardHead icon={MessageCircle} title="Replies sent" description="The last 30 days" href="/admin/usage" />
            <CardContent className="text-center">
              <p className="text-[13px] text-muted-foreground">This week</p>
              <p className="mt-0.5 flex flex-wrap items-center justify-center gap-x-2">
                <RollingNumber value={weekTotal} className="text-[2.5rem] leading-tight font-medium tracking-[-0.03em]" />
                <Delta pct={lastWeek > 0 ? Math.round(((weekTotal - lastWeek) * 100) / lastWeek) : null} />
              </p>
            </CardContent>
            <div className="mt-auto h-44 min-h-44">
              <AreaChart caption="Replies the bot sent each day, last 30 days" points={daily.map((d) => ({ label: shortDay(d.day), value: d.sent }))} />
            </div>
          </Card>

          <div className="rise @3xl:col-span-2 @6xl:col-span-1 @6xl:row-span-2 [&>*]:h-full" style={order(3)}>
            <UpcomingCard today={istDate()} events={upcoming} />
          </div>

          <Card className="rise @3xl:col-span-2" style={order(4)}>
            <CardHead icon={MousePointerClick} title="What people open" description="Menu items, last 30 days" href="/admin/menu" />
            <CardContent className="flex flex-1 flex-col">
              {taps.length === 0 ? (
                <EmptyState icon={MousePointerClick} title="Nothing opened yet" hint="As members tap the menu, the most-used items show here." className="py-4" />
              ) : (
                <BarChart
                  caption="How often each menu item was opened in the last 30 days"
                  highlight={0}
                  data={taps.slice(0, 8).map((t) => ({
                    label: t.title,
                    fullLabel: t.title,
                    value: t.n,
                    display: `${t.n.toLocaleString("en-IN")} opens`,
                  }))}
                />
              )}
            </CardContent>
          </Card>

          <Card className="rise" style={order(5)}>
            <CardHead icon={Inbox} title="Inbox" description={waiting ? `${waiting} waiting` : "All caught up"} href="/admin/inbox" />
            <CardContent>
              {inbox.length === 0 ? (
                <EmptyState icon={Inbox} title="Nothing new" hint="Prayer requests and form answers land here." className="py-2" />
              ) : (
                <ul className="space-y-1">
                  {inbox.map((i) => (
                    <li key={i.blockId}>
                      <Link
                        href={`/admin/inbox?form=${encodeURIComponent(i.blockId)}`}
                        className="flex min-h-11 items-center gap-3 rounded-2xl px-2 text-sm transition-[background-color] duration-150 ease-out hover:bg-foreground/[0.04]"
                      >
                        <span className="min-w-0 flex-1 truncate">{i.title}</span>
                        <span className="grid h-6 min-w-6 place-items-center rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground tabular-nums">
                          {i.count}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
