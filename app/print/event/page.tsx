"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useLoad } from "@/lib/use-load";

import { AutoPrint } from "../auto-print";
import { Doc, DocTable } from "../doc";

/** A door list for an event: names, numbers, how many, and a box to tick. */
export default function PrintEventPage() {
  return (
    <Suspense>
      <PrintEvent />
    </Suspense>
  );
}

function PrintEvent() {
  const id = useSearchParams().get("id") ?? "";
  const { data } = useLoad(() => Promise.all([api.events(), api.registrations(id)]));
  const event = data?.[0].find((e) => e.id === id);
  const regs = (data?.[1] ?? []).filter((r) => r.status === "confirmed").sort((a, b) => a.name.localeCompare(b.name));
  const people = regs.reduce((s, r) => s + r.headcount, 0);

  return (
    <>
      <AutoPrint ready={!!data} />
      {event && (
        <Doc
          title={event.title}
          subtitle={[formatDate(event.date), event.time, event.venue].filter(Boolean).join(" · ")}
        >
          <DocTable
            title={`Registered · ${people} people`}
            columns={[
              { label: "#", right: true },
              { label: "Name" },
              { label: "WhatsApp", nowrap: true },
              { label: "People", right: true },
              ...event.questions.map((q) => ({ label: q.label })),
              { label: "Here" },
            ]}
            rows={regs.map((r, i) => [
              i + 1,
              r.name || "—",
              `+${r.waId}`,
              r.headcount,
              ...event.questions.map((q) => r.answers[q.id] || "—"),
              <span key="box" className="inline-block size-4 border border-black" />,
            ])}
            foot={["", "Total", "", people, ...event.questions.map(() => ""), ""]}
            empty="No one has registered yet."
          />
        </Doc>
      )}
    </>
  );
}
