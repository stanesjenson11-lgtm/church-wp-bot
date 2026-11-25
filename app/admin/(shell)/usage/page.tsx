"use client";

import { Gauge } from "lucide-react";

import { BarChart } from "@/components/bar-chart";
import { CardHead } from "@/components/dash";
import { EmptyState } from "@/components/empty-state";
import { PageHead } from "@/components/fields";
import { ListSkeleton } from "@/components/skeletons";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { useLoad } from "@/lib/use-load";

const label = (month: string, style: "short" | "long") =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: style, ...(style === "long" ? { year: "numeric" } : {}), timeZone: "UTC" });

/**
 * Replies the bot has sent, month by month. Meta gives each number 1,000 free
 * replies a month; past that each costs about ₹0.14. Messages members send
 * are always free.
 */
export default function UsagePage() {
  const { data } = useLoad(() => Promise.all([api.usage(), api.overview()]));
  if (!data) return <ListSkeleton />;
  const [months, { usage }] = data;
  const recent = [...months].sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
  const total = months.reduce((s, m) => s + m.cost, 0);

  return (
    <div className="space-y-6">
      <PageHead
        title="Usage"
        description={`Meta gives ${usage.free.toLocaleString("en-IN")} free replies a month. After that each reply costs about ${formatMoney(String(usage.rate))}. Messages members send are always free.`}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="tile p-5">
          <p className="text-[13px] text-muted-foreground">This month</p>
          <p className="mt-0.5 text-[1.75rem] leading-tight font-medium tracking-[-0.03em] tabular-nums">{usage.sent.toLocaleString("en-IN")}</p>
          <p className="text-[13px] text-muted-foreground">replies sent</p>
        </div>
        <div className="tile p-5">
          <p className="text-[13px] text-muted-foreground">Free left</p>
          <p className="mt-0.5 text-[1.75rem] leading-tight font-medium tracking-[-0.03em] tabular-nums">{Math.max(0, usage.free - usage.sent).toLocaleString("en-IN")}</p>
          <p className="text-[13px] text-muted-foreground">until {new Date(`${usage.resetsOn}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "long", timeZone: "UTC" })}</p>
        </div>
        <div className="tile p-5">
          <p className="text-[13px] text-muted-foreground">Spent this month</p>
          <p className="mt-0.5 text-[1.75rem] leading-tight font-medium tracking-[-0.03em] tabular-nums">{formatMoney(String(usage.cost))}</p>
          <p className="text-[13px] text-muted-foreground">{usage.paid ? `${usage.paid.toLocaleString("en-IN")} paid replies` : "All within the free allowance"}</p>
        </div>
      </div>

      <Card>
        <CardHead icon={Gauge} title="Replies by month" description={total > 0 ? `${formatMoney(String(Math.round(total * 100) / 100))} spent in all` : "Nothing spent so far"} />
        <CardContent>
          {recent.length === 0 ? (
            <EmptyState icon={Gauge} title="No replies yet" hint="Each month's count appears here once the bot starts answering." />
          ) : (
            <BarChart
              caption="Replies sent each month"
              data={recent.map((m) => ({
                label: label(m.month, "short"),
                fullLabel: label(m.month, "long"),
                value: m.sent,
                display: `${m.sent.toLocaleString("en-IN")} replies`,
                detail: m.paid ? `${m.paid} paid · ${formatMoney(String(m.cost))}` : "All free",
              }))}
              tick={(n) => n.toLocaleString("en-IN")}
            />
          )}
        </CardContent>
      </Card>

      {recent.length > 0 && (
        <div className="tile overflow-x-auto px-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Replies</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...recent].reverse().map((m) => (
                <TableRow key={m.month}>
                  <TableCell>{label(m.month, "long")}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.sent.toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.paid.toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(String(m.cost))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
