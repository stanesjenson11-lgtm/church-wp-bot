"use client";

import { Search, Trash, Users } from "lucide-react";
import { useState } from "react";

import { Confirm } from "@/components/confirm";
import { EmptyRow } from "@/components/empty-state";
import { PageHead } from "@/components/fields";
import { useViewer } from "@/components/shell/app-shell";
import { ListSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDateTime, prettyPhone, whatsappLink } from "@/lib/format";
import { attempt, useLoad } from "@/lib/use-load";

/**
 * Everyone who has messaged the bot. Deleting a person removes everything
 * the bot holds about them: what the "delete my data" command does, for a
 * request that comes by phone or in person instead.
 */
export default function PeoplePage() {
  const viewer = useViewer();
  const { data, set } = useLoad(api.people);
  const [query, setQuery] = useState("");
  if (!data) return <ListSkeleton />;
  const q = query.trim().toLowerCase();
  const rows = data
    .filter((p) => !q || p.name.toLowerCase().includes(q) || p.waId.includes(q.replace(/\D/g, "") || "\u0000"))
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
  const admin = viewer.role === "admin";

  return (
    <div className="space-y-6">
      <PageHead title="People" description={`${data.length.toLocaleString("en-IN")} people have messaged the bot. Their WhatsApp name is shown.`}>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search people" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or number" className="h-11 w-60 rounded-full pl-9" />
        </div>
      </PageHead>

      <div className="tile overflow-x-auto px-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead className="hidden md:table-cell">First message</TableHead>
              <TableHead>Last message</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Events</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Forms</TableHead>
              {admin && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <EmptyRow
                colSpan={admin ? 7 : 6}
                icon={Users}
                title={q ? `No one matches “${query}”` : "No one has messaged yet"}
                hint={q ? undefined : "Share the bot's link from the Share page to get started."}
                action={q ? undefined : { href: "/admin/share", label: "Share the bot" }}
              />
            ) : (
              rows.map((p) => (
                <TableRow key={p.waId}>
                  <TableCell className="font-medium">{p.name || "—"}</TableCell>
                  <TableCell>
                    <a href={whatsappLink(p.waId, "")} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap tabular-nums hover:underline">
                      {prettyPhone(p.waId)}
                    </a>
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-muted-foreground tabular-nums md:table-cell">{formatDateTime(p.firstSeen)}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">{formatDateTime(p.lastSeen)}</TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">{p.registrations || "—"}</TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">{p.submissions || "—"}</TableCell>
                  {admin && (
                    <TableCell className="text-right">
                      <Confirm
                        trigger={
                          <Button variant="ghost" size="icon-sm" aria-label={`Delete ${p.name || prettyPhone(p.waId)}`}>
                            <Trash />
                          </Button>
                        }
                        title={`Delete everything about ${p.name || prettyPhone(p.waId)}?`}
                        description="Their name, number, event registrations and form answers are erased. Use this when someone asks for their data to be removed."
                        action="Delete their data"
                        onConfirm={async () => {
                          if (await attempt(() => api.deletePerson(p.waId), "Their data was deleted")) set(data.filter((x) => x.waId !== p.waId));
                        }}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
